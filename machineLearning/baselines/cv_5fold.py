"""5-fold stratified CV for the champion (best-params) models on both tracks.

Refits each model with its tuned hyperparameters across 5 stratified folds
to confirm the single-split AUC is not a lucky/unlucky draw. Calibrates XGB
inside each fold (matching the production pipeline).
"""
import json
import pathlib
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score, precision_recall_curve, auc, f1_score
from sklearn.model_selection import StratifiedKFold
from sklearn.calibration import CalibratedClassifierCV
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier

base = pathlib.Path(r"c:/Users/thira/Documents/GitHub/project-d")
df = pd.read_csv(base / "machineLearning" / "csv" / "ml_ready_dataset.csv")
mdir = base / "machineLearning" / "models"


def best_params(estimator):
    """Pull the saved estimator's actual hyperparams (set during the original tuning)."""
    return estimator.get_params()


def f1_at_train_threshold(y_train, p_train, y_test, p_test):
    """F1-max threshold learned on TRAIN, applied to TEST (matches production)."""
    pr_p, pr_r, thrs = precision_recall_curve(y_train, p_train)
    f1s = (2 * pr_p[:-1] * pr_r[:-1]) / (pr_p[:-1] + pr_r[:-1] + 1e-10)
    thr = thrs[np.argmax(f1s)]
    return f1_score(y_test, (p_test >= thr).astype(int)), thr


def run_track(track_name, X, y, scaler, lr_model, rf_model, xgb_calibrated, cont_cols):
    print(f"\n=== {track_name} — 5-fold stratified CV ===")
    print(f"Total n={len(y)}, +rate={y.mean():.4f}")

    # Recover the underlying XGB hyperparams from the calibrated wrapper.
    xgb_inner = xgb_calibrated.calibrated_classifiers_[0].estimator
    xgb_params = {k: v for k, v in xgb_inner.get_params().items() if k not in ("missing",)}

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    rows = {"LR": [], "RF": [], "XGB (calibrated)": []}

    for fold_i, (tr_idx, te_idx) in enumerate(skf.split(X, y), 1):
        X_tr, X_te = X.iloc[tr_idx], X.iloc[te_idx]
        y_tr, y_te = y.iloc[tr_idx], y.iloc[te_idx]

        # Fresh ColumnTransformer per fold (must be re-fit on the fold's train).
        bin_cols = [c for c in X.columns if c not in cont_cols]
        pre = ColumnTransformer([("num", StandardScaler(), cont_cols), ("cat", "passthrough", bin_cols)])
        X_tr_s = pre.fit_transform(X_tr)
        X_te_s = pre.transform(X_te)

        # LR
        lr_p = best_params(lr_model)
        lr = LogisticRegression(**{k: v for k, v in lr_p.items() if k in (
            "C", "solver", "max_iter", "random_state", "class_weight", "penalty")})
        lr.fit(X_tr_s, y_tr)
        p_tr = lr.predict_proba(X_tr_s)[:, 1]
        p_te = lr.predict_proba(X_te_s)[:, 1]
        f1, _ = f1_at_train_threshold(y_tr, p_tr, y_te, p_te)
        rows["LR"].append((roc_auc_score(y_te, p_te), auc(*precision_recall_curve(y_te, p_te)[:2][::-1]), f1))

        # RF
        rf_p = best_params(rf_model)
        rf = RandomForestClassifier(**{k: v for k, v in rf_p.items() if k in (
            "n_estimators", "max_depth", "min_samples_split", "min_samples_leaf",
            "class_weight", "random_state", "n_jobs")})
        rf.fit(X_tr_s, y_tr)
        p_tr = rf.predict_proba(X_tr_s)[:, 1]
        p_te = rf.predict_proba(X_te_s)[:, 1]
        f1, _ = f1_at_train_threshold(y_tr, p_tr, y_te, p_te)
        rows["RF"].append((roc_auc_score(y_te, p_te), auc(*precision_recall_curve(y_te, p_te)[:2][::-1]), f1))

        # XGB (calibrated, matches production)
        keep = {"max_depth", "learning_rate", "n_estimators", "subsample", "colsample_bytree",
                "scale_pos_weight", "eval_metric", "random_state"}
        xgb = XGBClassifier(**{k: v for k, v in xgb_params.items() if k in keep})
        cal = CalibratedClassifierCV(xgb, method="isotonic", cv=5)
        cal.fit(X_tr_s, y_tr)
        p_tr = cal.predict_proba(X_tr_s)[:, 1]
        p_te = cal.predict_proba(X_te_s)[:, 1]
        f1, _ = f1_at_train_threshold(y_tr, p_tr, y_te, p_te)
        rows["XGB (calibrated)"].append((roc_auc_score(y_te, p_te), auc(*precision_recall_curve(y_te, p_te)[:2][::-1]), f1))

        print(f"  Fold {fold_i}/5 done")

    print(f"\n{'Model':<22s} {'ROC-AUC mean ± std':<22s} {'PR-AUC mean ± std':<22s} {'F1 mean ± std':<20s}")
    print("-" * 90)
    for name, fs in rows.items():
        rocs = [r[0] for r in fs]
        prs = [r[1] for r in fs]
        f1s = [r[2] for r in fs]
        print(f"{name:<22s} {np.mean(rocs):.4f} ± {np.std(rocs):.4f}     "
              f"{np.mean(prs):.4f} ± {np.std(prs):.4f}     "
              f"{np.mean(f1s):.4f} ± {np.std(f1s):.4f}")
    return rows


# Track A
print("[" + ("=" * 30) + " TRACK A " + ("=" * 30) + "]")
target_a = "Admitted_Yes_No"
leak_a = ["Readmitted_Yes_No", "Num_Admissions", "Index_LOS"]
X_a = df.drop(columns=[target_a] + leak_a, errors="ignore")
y_a = df[target_a]
cont_a = ["AGE", "Num_Visits", "Total_Meds_Count", "Total_Unique_Diagnoses", "Severity_Encoded"]

run_track("Track A — Admission", X_a, y_a,
          joblib.load(mdir / "standard_scaler.pkl"),
          joblib.load(mdir / "logistic_regression_admission.pkl"),
          joblib.load(mdir / "random_forest_admission.pkl"),
          joblib.load(mdir / "xgboost_admission.pkl"),
          cont_a)

# Track B
print("\n[" + ("=" * 30) + " TRACK B " + ("=" * 30) + "]")
target_b = "Readmitted_Yes_No"
df_adm = df[df["Admitted_Yes_No"] == 1].copy()
leak_b = ["Admitted_Yes_No", "Num_Admissions", "Num_Visits", target_b]
X_b = df_adm.drop(columns=leak_b, errors="ignore")
y_b = df_adm[target_b]
cont_b = ["AGE", "Index_LOS", "Total_Meds_Count", "Total_Unique_Diagnoses", "Severity_Encoded"]

run_track("Track B — Readmission", X_b, y_b,
          joblib.load(mdir / "standard_scaler_readmission.pkl"),
          joblib.load(mdir / "logistic_regression_readmission.pkl"),
          joblib.load(mdir / "random_forest_readmission.pkl"),
          joblib.load(mdir / "xgboost_readmission.pkl"),
          cont_b)

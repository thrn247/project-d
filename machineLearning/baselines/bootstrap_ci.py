"""Bootstrap 95% CIs for ROC-AUC and PR-AUC across both tracks.

1,000 resamples with replacement on the held-out test set predictions.
Reports point estimate + 95% percentile CI for every model.
"""
import json
import pathlib
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score, precision_recall_curve, auc
from sklearn.model_selection import train_test_split

base = pathlib.Path(r"c:/Users/thira/Documents/GitHub/project-d")
df = pd.read_csv(base / "machineLearning" / "csv" / "ml_ready_dataset.csv")
mdir = base / "machineLearning" / "models"


def bootstrap_aucs(y_true, y_proba, n=1000, seed=42):
    """Returns (roc_auc_point, roc_low, roc_high, pr_point, pr_low, pr_high)."""
    rng = np.random.default_rng(seed)
    y_true = np.asarray(y_true)
    y_proba = np.asarray(y_proba)
    roc_aucs, pr_aucs = [], []
    for _ in range(n):
        idx = rng.integers(0, len(y_true), len(y_true))
        yt, yp = y_true[idx], y_proba[idx]
        if len(np.unique(yt)) < 2:
            continue
        roc_aucs.append(roc_auc_score(yt, yp))
        pr_p, pr_r, _ = precision_recall_curve(yt, yp)
        pr_aucs.append(auc(pr_r, pr_p))
    return (
        roc_auc_score(y_true, y_proba),
        np.percentile(roc_aucs, 2.5), np.percentile(roc_aucs, 97.5),
        auc(*precision_recall_curve(y_true, y_proba)[:2][::-1]),
        np.percentile(pr_aucs, 2.5), np.percentile(pr_aucs, 97.5),
    )


def report_track(track_name, X_te, y_te, models):
    print(f"\n=== {track_name} (test n={len(y_te)}, +rate={y_te.mean():.4f}) ===")
    print(f"{'Model':<35s} {'ROC-AUC [95% CI]':<28s} {'PR-AUC [95% CI]':<28s}")
    print("-" * 95)
    for name, model in models:
        p = model.predict_proba(X_te)[:, 1]
        rp, rl, rh, pp, pl, ph = bootstrap_aucs(y_te, p, n=1000, seed=42)
        print(f"{name:<35s} {rp:.4f} [{rl:.4f}-{rh:.4f}]   {pp:.4f} [{pl:.4f}-{ph:.4f}]")


# Track A
target_a = "Admitted_Yes_No"
leak_a = ["Readmitted_Yes_No", "Num_Admissions", "Index_LOS"]
X_a = df.drop(columns=[target_a] + leak_a, errors="ignore")
y_a = df[target_a]
_, Xa_te, _, ya_te = train_test_split(X_a, y_a, test_size=0.2, random_state=42, stratify=y_a)
scaler_a = joblib.load(mdir / "standard_scaler.pkl")
Xa_te_arr = scaler_a.transform(Xa_te)

report_track("TRACK A — ADMISSION", Xa_te_arr, ya_te.values, [
    ("Logistic Regression", joblib.load(mdir / "logistic_regression_admission.pkl")),
    ("Random Forest",       joblib.load(mdir / "random_forest_admission.pkl")),
    ("XGBoost (calibrated)", joblib.load(mdir / "xgboost_admission.pkl")),
])

# Track B
target_b = "Readmitted_Yes_No"
df_adm = df[df["Admitted_Yes_No"] == 1].copy()
leak_b = ["Admitted_Yes_No", "Num_Admissions", "Num_Visits", target_b]
X_b = df_adm.drop(columns=leak_b, errors="ignore")
y_b = df_adm[target_b]
_, Xb_te, _, yb_te = train_test_split(X_b, y_b, test_size=0.2, random_state=42, stratify=y_b)
scaler_b = joblib.load(mdir / "standard_scaler_readmission.pkl")
Xb_te_arr = scaler_b.transform(Xb_te)

report_track("TRACK B — READMISSION", Xb_te_arr, yb_te.values, [
    ("Logistic Regression", joblib.load(mdir / "logistic_regression_readmission.pkl")),
    ("Random Forest",       joblib.load(mdir / "random_forest_readmission.pkl")),
    ("XGBoost (calibrated)", joblib.load(mdir / "xgboost_readmission.pkl")),
])

print("\n[1,000-resample bootstrap, seed=42]")

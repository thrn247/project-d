"""
Post-process calibration of the XGBoost champions for both tracks.

Wraps the un-calibrated trained XGB pickles with `CalibratedClassifierCV`
(isotonic, cv=5) so the dashboard surfaces probabilities that are
empirically meaningful — when the model says "87%", roughly 87% of
similar patients in the test set are admitted.

The calibration is post-hoc: the upstream notebooks
(`02_ML_Model_Admission.ipynb`, `03_ML_Model_Readmission.ipynb`) train
the models on the full TRAIN split. This script reproduces the same
splits via `random_state=42`, fits a 5-fold internal CV calibrator on
TRAIN, re-finds the F1-max threshold on calibrated TRAIN probas, and
overwrites the production pickles + `thresholds.json` keys.

LR and RF are intentionally NOT calibrated — only the production XGBoost
champions are consumed by the dashboard.

Run AFTER both ML notebooks finish.
"""

import os
import json
import pathlib
import numpy as np
import pandas as pd
import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sklearn.base import clone
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    roc_auc_score, average_precision_score, classification_report,
    brier_score_loss, precision_recall_curve,
)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
base_path = os.environ.get(
    "PROJECT_D_BASE",
    str(pathlib.Path(__file__).resolve().parents[2]),
)
ml_csv = os.path.join(base_path, "machineLearning", "csv", "ml_ready_dataset.csv")
models_dir = os.path.join(base_path, "machineLearning", "models")
plots_dir = os.path.join(base_path, "machineLearning", "plots")
os.makedirs(plots_dir, exist_ok=True)
thresholds_path = os.path.join(models_dir, "thresholds.json")
dash_thresholds_path = os.path.join(
    base_path, "diabetesDashboard", "public", "data", "thresholds.json"
)


def find_f1_max_threshold(y_true, y_proba):
    """Pick the threshold that maximises F1 on the precision-recall curve."""
    precs, recs, thrs = precision_recall_curve(y_true, y_proba)
    f1s = 2 * precs * recs / (precs + recs + 1e-9)
    # `thrs` has length len(precs)-1; align by trimming the trailing point.
    return float(thrs[np.argmax(f1s[:-1])])


def reliability_plot(y_true, p_uncal, p_cal, brier_uncal, brier_cal, title, out_path):
    fig, ax = plt.subplots(figsize=(6.5, 6))
    ax.plot([0, 1], [0, 1], "k--", lw=1, label="Perfect calibration")

    pre_obs, pre_pred = calibration_curve(y_true, p_uncal, n_bins=10, strategy="quantile")
    post_obs, post_pred = calibration_curve(y_true, p_cal, n_bins=10, strategy="quantile")

    ax.plot(pre_pred, pre_obs, "o-", label=f"Uncalibrated  (Brier {brier_uncal:.4f})")
    ax.plot(post_pred, post_obs, "s-", label=f"Isotonic-calibrated  (Brier {brier_cal:.4f})")

    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_xlabel("Mean predicted probability")
    ax.set_ylabel("Observed event rate")
    ax.set_title(title)
    ax.legend(loc="upper left")
    plt.tight_layout()
    plt.savefig(out_path, dpi=120)
    plt.close(fig)


# ---------------------------------------------------------------------------
# Track A — admission
# ---------------------------------------------------------------------------
def calibrate_admission():
    print("\n=== Track A — Admission XGB calibration ===")

    df = pd.read_csv(ml_csv)
    target = "Admitted_Yes_No"
    leakage_cols = ["Readmitted_Yes_No", "Num_Admissions", "Index_LOS"]
    X_raw = df.drop(columns=[target] + leakage_cols, errors="ignore")
    y = df[target]

    # Reproduce the notebook's split exactly (stratified, random_state=42).
    X_train_raw, X_test_raw, y_train, y_test = train_test_split(
        X_raw, y, test_size=0.2, random_state=42, stratify=y
    )

    # Apply the saved fitted preprocessor (ColumnTransformer).
    scaler = joblib.load(os.path.join(models_dir, "standard_scaler.pkl"))
    feature_names = pd.read_csv(
        os.path.join(models_dir, "feature_names.csv")
    )["features"].tolist()

    X_train = pd.DataFrame(
        scaler.transform(X_train_raw), columns=feature_names, index=X_train_raw.index
    )
    X_test = pd.DataFrame(
        scaler.transform(X_test_raw), columns=feature_names, index=X_test_raw.index
    )

    # Load uncalibrated production XGB.
    xgb_uncal = joblib.load(os.path.join(models_dir, "xgboost_admission.pkl"))

    # Idempotency guard: if Track A admission was already calibrated by a prior
    # run of this script, just re-derive the threshold from the saved model and
    # skip the re-calibration step (re-calibrating a CalibratedClassifierCV
    # wraps it recursively, which degrades quality).
    if isinstance(xgb_uncal, CalibratedClassifierCV):
        print("Track A admission pickle is already calibrated; skipping re-calibration.")
        cal = xgb_uncal
        p_train_cal = cal.predict_proba(X_train)[:, 1]
        p_test_cal = cal.predict_proba(X_test)[:, 1]
        optimal_thr = find_f1_max_threshold(y_train, p_train_cal)
        brier_cal = brier_score_loss(y_test, p_test_cal)
        auc_cal = roc_auc_score(y_test, p_test_cal)
        pr_cal = average_precision_score(y_test, p_test_cal)
        print(f"Already-cal: ROC-AUC {auc_cal:.4f}  PR-AUC {pr_cal:.4f}  Brier {brier_cal:.4f}")
        print(f"F1-max threshold (already-calibrated): {optimal_thr:.4f}")
        return optimal_thr, {"roc_auc": auc_cal, "pr_auc": pr_cal, "brier": brier_cal}

    # Pre-calibration baseline.
    p_test_uncal = xgb_uncal.predict_proba(X_test)[:, 1]
    brier_uncal = brier_score_loss(y_test, p_test_uncal)
    auc_uncal = roc_auc_score(y_test, p_test_uncal)
    pr_uncal = average_precision_score(y_test, p_test_uncal)
    print(f"Pre-cal:  ROC-AUC {auc_uncal:.4f}  PR-AUC {pr_uncal:.4f}  Brier {brier_uncal:.4f}")

    # Calibrate via 5-fold internal CV on TRAIN.
    print("Fitting CalibratedClassifierCV (isotonic, cv=5) on TRAIN...")
    cal = CalibratedClassifierCV(estimator=clone(xgb_uncal), method="isotonic", cv=5)
    cal.fit(X_train, y_train)

    p_train_cal = cal.predict_proba(X_train)[:, 1]
    p_test_cal = cal.predict_proba(X_test)[:, 1]

    optimal_thr = find_f1_max_threshold(y_train, p_train_cal)
    y_pred = (p_test_cal >= optimal_thr).astype(int)

    brier_cal = brier_score_loss(y_test, p_test_cal)
    auc_cal = roc_auc_score(y_test, p_test_cal)
    pr_cal = average_precision_score(y_test, p_test_cal)
    print(f"Post-cal: ROC-AUC {auc_cal:.4f}  PR-AUC {pr_cal:.4f}  Brier {brier_cal:.4f}")
    print(f"F1-max threshold (calibrated): {optimal_thr:.4f}")
    print("Classification report (calibrated, test):")
    print(classification_report(y_test, y_pred))

    reliability_plot(
        y_test, p_test_uncal, p_test_cal, brier_uncal, brier_cal,
        "Track A (Admission) — Reliability Diagram",
        os.path.join(plots_dir, "Admission_Calibration_Curve.png"),
    )

    # Save calibrated wrapper as the production pickle.
    joblib.dump(cal, os.path.join(models_dir, "xgboost_admission.pkl"))
    print(f"Saved calibrated XGB -> {os.path.join(models_dir, 'xgboost_admission.pkl')}")

    return optimal_thr, {"roc_auc": auc_cal, "pr_auc": pr_cal, "brier": brier_cal}


# ---------------------------------------------------------------------------
# Track B — readmission
# ---------------------------------------------------------------------------
def calibrate_readmission():
    print("\n=== Track B — Readmission XGB calibration ===")

    df = pd.read_csv(ml_csv)
    df_admitted = df[df["Admitted_Yes_No"] == 1].copy()
    target = "Readmitted_Yes_No"
    leakage_cols = ["Admitted_Yes_No", "Num_Admissions", "Num_Visits"]
    X_raw = df_admitted.drop(columns=[target] + leakage_cols, errors="ignore")
    y = df_admitted[target]

    X_train_raw, X_test_raw, y_train, y_test = train_test_split(
        X_raw, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = joblib.load(os.path.join(models_dir, "standard_scaler_readmission.pkl"))
    # Track B's column order is determined by the saved scaler's transformers.
    # Use the columns in X_train_raw's order; the scaler internally reorders.
    continuous_cols = ["AGE", "Index_LOS", "Total_Meds_Count", "Total_Unique_Diagnoses", "Severity_Encoded"]
    binary_cols = [c for c in X_train_raw.columns if c not in continuous_cols]
    new_order = continuous_cols + binary_cols

    X_train = pd.DataFrame(scaler.transform(X_train_raw), columns=new_order, index=X_train_raw.index)
    X_test = pd.DataFrame(scaler.transform(X_test_raw), columns=new_order, index=X_test_raw.index)

    xgb_uncal = joblib.load(os.path.join(models_dir, "xgboost_readmission.pkl"))

    # Idempotency guard (same pattern as Track A).
    if isinstance(xgb_uncal, CalibratedClassifierCV):
        print("Track B readmission pickle is already calibrated; skipping re-calibration.")
        cal = xgb_uncal
        p_train_cal = cal.predict_proba(X_train)[:, 1]
        p_test_cal = cal.predict_proba(X_test)[:, 1]
        optimal_thr = find_f1_max_threshold(y_train, p_train_cal)
        brier_cal = brier_score_loss(y_test, p_test_cal)
        auc_cal = roc_auc_score(y_test, p_test_cal)
        pr_cal = average_precision_score(y_test, p_test_cal)
        print(f"Already-cal: ROC-AUC {auc_cal:.4f}  PR-AUC {pr_cal:.4f}  Brier {brier_cal:.4f}")
        print(f"F1-max threshold (already-calibrated): {optimal_thr:.4f}")
        return optimal_thr, {"roc_auc": auc_cal, "pr_auc": pr_cal, "brier": brier_cal}

    p_test_uncal = xgb_uncal.predict_proba(X_test)[:, 1]
    brier_uncal = brier_score_loss(y_test, p_test_uncal)
    auc_uncal = roc_auc_score(y_test, p_test_uncal)
    pr_uncal = average_precision_score(y_test, p_test_uncal)
    print(f"Pre-cal:  ROC-AUC {auc_uncal:.4f}  PR-AUC {pr_uncal:.4f}  Brier {brier_uncal:.4f}")

    print("Fitting CalibratedClassifierCV (isotonic, cv=5) on TRAIN...")
    cal = CalibratedClassifierCV(estimator=clone(xgb_uncal), method="isotonic", cv=5)
    cal.fit(X_train, y_train)

    p_train_cal = cal.predict_proba(X_train)[:, 1]
    p_test_cal = cal.predict_proba(X_test)[:, 1]

    optimal_thr = find_f1_max_threshold(y_train, p_train_cal)
    y_pred = (p_test_cal >= optimal_thr).astype(int)

    brier_cal = brier_score_loss(y_test, p_test_cal)
    auc_cal = roc_auc_score(y_test, p_test_cal)
    pr_cal = average_precision_score(y_test, p_test_cal)
    print(f"Post-cal: ROC-AUC {auc_cal:.4f}  PR-AUC {pr_cal:.4f}  Brier {brier_cal:.4f}")
    print(f"F1-max threshold (calibrated): {optimal_thr:.4f}")
    print("Classification report (calibrated, test):")
    print(classification_report(y_test, y_pred))

    reliability_plot(
        y_test, p_test_uncal, p_test_cal, brier_uncal, brier_cal,
        "Track B (Readmission) — Reliability Diagram",
        os.path.join(plots_dir, "Readmission_Calibration_Curve.png"),
    )

    joblib.dump(cal, os.path.join(models_dir, "xgboost_readmission.pkl"))
    print(f"Saved calibrated XGB -> {os.path.join(models_dir, 'xgboost_readmission.pkl')}")

    return optimal_thr, {"roc_auc": auc_cal, "pr_auc": pr_cal, "brier": brier_cal}


# ---------------------------------------------------------------------------
# Update thresholds.json (read-merge-write, both keys)
# ---------------------------------------------------------------------------
def update_thresholds(adm_thr, readm_thr):
    print("\n=== Updating thresholds.json ===")
    if os.path.exists(thresholds_path):
        with open(thresholds_path) as f:
            thresholds = json.load(f)
    else:
        thresholds = {}

    thresholds["xgb_admission"] = float(adm_thr)
    thresholds["xgb_readmission"] = float(readm_thr)

    with open(thresholds_path, "w") as f:
        json.dump(thresholds, f, indent=2)
    print(f"Wrote thresholds.json: xgb_admission={adm_thr:.4f}  xgb_readmission={readm_thr:.4f}")

    slim = {
        "admission": float(adm_thr),
        "readmission": float(readm_thr),
    }
    with open(dash_thresholds_path, "w") as f:
        json.dump(slim, f)
    print(f"Mirrored to dashboard: {slim}")


if __name__ == "__main__":
    adm_thr, adm_metrics = calibrate_admission()
    readm_thr, readm_metrics = calibrate_readmission()
    update_thresholds(adm_thr, readm_thr)

    print("\n=== Summary ===")
    print(f"Admission   thr={adm_thr:.4f}   ROC-AUC {adm_metrics['roc_auc']:.4f}   Brier {adm_metrics['brier']:.4f}")
    print(f"Readmission thr={readm_thr:.4f}   ROC-AUC {readm_metrics['roc_auc']:.4f}   Brier {readm_metrics['brier']:.4f}")
    print("Calibration complete.")

# DART — Diabetic Admission Readmission Tool

Final-year capstone (`BDH2372 Research Project II`, IMU University, Bachelor in Digital Health (Hons)). DART trains XGBoost risk scores for (A) initial hospital admission and (B) readmission in Malaysian Type-2 diabetes patients on a PMCare Third-Party-Administrator claims extract, and surfaces them through a React expert-review dashboard.

- **Cohort:** 61,406 patients (ICD-10 `E11.*` filter) → 7,959 admitted → 2,214 readmitted
- **Champion model (readmission):** XGBoost, ROC-AUC 0.876, PR-AUC 0.767
- **Novel design:** dual-track — Track A trains on all patients, Track B trains only on admitted patients
- **Live dashboard:** https://projectd-theta.vercel.app

See [CLAUDE.md](CLAUDE.md) for the full spec, dataset facts, and known issues.

---

## Prerequisites

- **Python 3.10 or 3.11** (scikit-learn / XGBoost / SHAP stack)
- **Node.js 20+** and npm
- ~6 GB free disk (the intermediate `.xlsx` files are large)

Python packages:
```
pandas polars numpy scikit-learn xgboost shap joblib openpyxl matplotlib seaborn jupyter
```

Install with:
```bash
python -m pip install pandas polars numpy scikit-learn xgboost shap joblib openpyxl matplotlib seaborn jupyter
```

---

## Pipeline run order

All paths below are repo-relative. The notebooks and scripts auto-resolve `base_path` from the file location, so you do not need to edit any hardcoded paths.

### 1. Data preprocessing
```bash
cd dataPreprocessing/source\ code
python 00_convert_parquet_to_excel.py           # one-off: parquet → xlsx
python 01_clean_and_filter_claims.py            # Polars filter + provider blacklist
jupyter nbconvert --to notebook --execute 02_reshape_claims.ipynb --inplace
jupyter nbconvert --to notebook --execute 03_feature_engineering.ipynb --inplace
jupyter nbconvert --to notebook --execute 04_aggregate_patients.ipynb --inplace
# 05_eda.ipynb is optional descriptive analysis
```

### 2. Machine learning (Track A + Track B)
```bash
cd machineLearning/source\ code
jupyter nbconvert --to notebook --execute 01_ML_Data_Prep.ipynb --inplace
jupyter nbconvert --to notebook --execute 02_ML_Model_Admission.ipynb --inplace
jupyter nbconvert --to notebook --execute 03_ML_Model_Readmission.ipynb --inplace
```

The notebooks write:
- `machineLearning/models/xgboost_admission.pkl`, `standard_scaler.pkl`, `feature_names.csv`, `logistic_regression_admission.pkl`, `random_forest_admission.pkl`
- `machineLearning/models/xgboost_readmission.pkl`, `standard_scaler_readmission.pkl`, `logistic_regression_readmission.pkl`, `random_forest_readmission.pkl`
- `machineLearning/models/thresholds.json` (train-learned F1-max thresholds for both tracks)
- `machineLearning/models/model_metadata.txt`
- `machineLearning/plots/01-04_*` (Track A) + `05-08_Readmission_*` (Track B)

### 3. Build dashboard payload
```bash
cd diabetesDashboard/scripts
python build_export.py          # writes public/data/dashboard_payload.json + thresholds.json
python export_shap_plots.py     # writes 4 SHAP JSONs under public/data/
```

### 4. Dashboard dev server
```bash
cd diabetesDashboard
npm install
npm run dev
```

---

## Key conventions

- **Anonymization:** the only reverse key is `dataPreprocessing/csv/patient_id_key.xlsx` (mapping `P00001…P62135` ↔ raw `PATIENT_CODE`). Do not commit the raw parquet or any derivative containing `PATIENT_CODE` beyond this one file.
- **Severity source of truth:** `ml_ready_dataset.csv.Severity_Encoded` with `{0: Mild, 1: Moderate, 2: Severe}`. The risk-bucketed severity logic in the legacy notebook is deprecated.
- **Thresholds:** the single source of truth is `machineLearning/models/thresholds.json`. `build_export.py` copies a slim version into `diabetesDashboard/public/data/thresholds.json` which the React app reads.
- **Feature prefixes:** `MED_*`, `COMP_*`, and the exact column order in `ml_ready_dataset.csv` are contract — downstream code discovers features by prefix match.

---

## Reproducing on a different machine

```bash
# Optional — override the repo root if your layout differs
export PROJECT_D_BASE=/path/to/project-d      # Linux/macOS
set PROJECT_D_BASE=C:\path\to\project-d       # Windows cmd
```

All scripts resolve `base_path` via `pathlib.Path(__file__).resolve().parents[2]` by default, so from a fresh clone the above env var is usually unnecessary.

---

## Licence / citation

Academic project. Cite as:
> Thiranbarath (2026). *AI-Assisted Diabetes Admission & Readmission Risk Pipeline*. BDH2372 Research Project II, IMU University.

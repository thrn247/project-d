# CLAUDE.md — Project D: AI-Assisted Diabetes Admission & Readmission Risk Pipeline

> Context file for Claude Code (VS Code extension). Read this **first** before editing, auditing, or extending any part of this repository.

---

## 1. Project identity

**Owner:** Thiranbarath (student ID `00000042906`), IMU University, Bachelor in Digital Health (Hons), final-year capstone `BDH2372 Research Project II`.

**One-line purpose:** Develop, interpret, and surface XGBoost-based risk scores for (A) initial hospital admission and (B) all-cause recurrent inpatient admission ("readmission") in Malaysian Type-2 diabetes patients, using a real-world PMCare Third-Party-Administrator claims extract, and expose the results through a React expert-review dashboard for formative usability evaluation.

> **Target definition note (important):** `Readmitted_Yes_No = (Num_Admissions > 1)` flags any patient with two or more inpatient admissions across the data window. This is **not** the standard 30-day readmission window used by UCI / LACE / MIMIC-III studies. Internally coherent, but every literature comparison must say so explicitly — see §8 and §13.

**Repo:** `github.com/thrn247/project-d`
**Live dashboard:** `https://projectd-theta.vercel.app`

**Methodological signature (novel vs. published literature):** A **dual-track** design — Track A trains on all patients to predict admission; Track B trains only on admitted patients to predict readmission. This split is not used by any of the comparator studies (UCI 130-US Hospitals, MIMIC-III, Health Facts, Temple EHR, etc.).

---

## 2. Top-level layout

```
project-d/
├── dataPreprocessing/              # Raw claims → patient-level feature matrix
│   └── source code/                # 2 Python scripts + 5 Jupyter notebooks
├── machineLearning/                # Track A + Track B training, eval, export
│   ├── source code/                # 3 Jupyter notebooks (01 prep, 02 admission, 03 readmission)
│   ├── csv/ml_ready_dataset.csv    # 62,135 × 26 — committed (whitelisted)
│   ├── models/                     # 6 model pickles + 2 scalers + feature_names.csv + thresholds.json + model_metadata.txt
│   └── plots/                      # 8 files — 4 admission (01–04) + 4 readmission (05–08)
├── diabetesDashboard/              # React + Vite front-end (deployed on Vercel)
│   ├── src/                        # App + 3 components
│   ├── public/data/                # dashboard_payload.json + 4 SHAP JSONs + thresholds.json
│   └── scripts/                    # build_export.py + export_shap_plots.py
├── .gitignore                      # Whitelist-style — most binaries blocked
└── .gitattributes
```

**Data flow (left to right):**
`parquet → step1_claims_filtered.xlsx → step2_claims_wide_format.xlsx → step3_claims_meds_and_comps.xlsx → step4_patient_aggregated.xlsx → ml_ready_dataset.csv → {trained pickles + scalers} → dashboard JSON payloads → React dashboard`

**Anonymization:** `patient_id_key.xlsx` (committed) maps synthetic `Patient_ID` (P00001…P62135) back to the raw `PATIENT_CODE`. This is the only reverse-key in the repo.

---

## 3. Dataset facts (from `machineLearning/csv/ml_ready_dataset.csv`)

| Property | Value |
|---|---|
| Rows (patients) | **62,135** |
| Columns | **26** |
| ICD-10 cohort filter | `E11.*` (Type-2 DM) |
| Admitted (`Admitted_Yes_No == 1`) | **7,999** (12.87%) |
| Readmitted (globally) | 2,228 |
| Readmission rate among admitted | **27.85%** |
| Severity: Mild/Moderate/Severe | 43,711 / 17,758 / 666 |

**Feature families present in the ML-ready CSV:**
- Numeric: `AGE`, `Avg_LOS`, `Num_Admissions`, `Num_Visits`, `Total_Meds_Count`, `Total_Unique_Diagnoses`, `Severity_Encoded`
- Medication flags (10): `MED_ALPHA_GLUCOSIDE_INHIBITORS`, `MED_BIGUANIDE`, `MED_COMBINATION_DRUG`, `MED_DPP_4_INHIBITORS`, `MED_GLP_1_RECEPTOR_AGONISTS`, `MED_INSULIN_THERAPY`, `MED_MEGLITINIDES`, `MED_SGLT_2_INHIBITORS`, `MED_SULPHONYLUREAS`, `MED_THIAZOLIDINEDIONES`
- Complication flags (5): `COMP_DIABETIC_FOOT`, `COMP_MACROVASCULAR`, `COMP_NEPHROPATHY`, `COMP_NEUROPATHY`, `COMP_RETINOPATHY`
- Demographic one-hot: `SEX_M`
- Targets: `Admitted_Yes_No`, `Readmitted_Yes_No`
- Derived flag: `Complication_Yes_No`

---

## 4. `dataPreprocessing/` — detailed pipeline

All scripts assume the current working directory is `dataPreprocessing/source code/` and a sibling `../csv/` folder exists.

### 4.1 `00_convert_parquet_to_excel.py`
- Reads every `*.parquet` in `../parquet/` and writes `.xlsx` siblings.
- Truncates at 1,000,000 rows (Excel hard limit).
- **Runs once per data refresh.** Not idempotent — it overwrites.

### 4.2 `01_clean_and_filter_claims.py`
- Polars-based (not pandas — for speed on millions of rows).
- Input: `../parquet/e11_claims.parquet`
- Output: `../csv/step1_claims_filtered.xlsx`
- **Provider blacklist:** drops rows where `PROVIDER_CODE ∈ {"SUPP343", "PHAR455", "PHAR588", "KPJ036"}` (pharmacy/supplier records with no clinical encounter).
- **Columns dropped** (non-analytical / leakage / PII): `DIAGNOSIS_LMGROUP`, `RELATION`, `CLAIM_AMOUNT`, `APPROVE_AMOUNT`, `CLAIMANT_TYPE_CODE`, `TREATMENT_DETAIL_CODE`, `GL_CODE`, `BATCH_CODE`, `CLAIM_STATUS_CODE`, `SERVICE_TYPE_CODE`, `COMPANY_CODE`, `PROVIDER_CODE`, `DIAGNOSIS_DESCRIPTION`, `SERVICE_DATE`, `DISCHARGE_DATE`.
- Critically **keeps `OTHER_DIAGNOSIS`** — required for the secondary-diagnosis pivot in step 2.

### 4.3 `02_reshape_claims.ipynb` (3 code cells)
- Inputs: `step1_claims_filtered.xlsx` + `diabetes_list_of_complications.xlsx` (master, not in repo).
- Auto-detects `code_col` / `desc_col` in the master by substring match (`"code"+"diabetes|diag"`, `"desc"`).
- Maps free-text `DIAGNOSIS` descriptions to ICD-10 codes using a `pd.Series(...).to_dict()` lookup.
- Pivots multi-line diagnoses wide into `DIAG_1, DIAG_2, …` columns on `CLAIM_CODE`.
- Output: `step2_claims_wide_format.xlsx`.

### 4.4 `03_feature_engineering.ipynb` (4 code cells)
- Inputs: `step2_claims_wide_format.xlsx`, `medication_data.xlsx`, `Medication Master.xlsx`, `diabetes_list_of_complications.xlsx`.
- **Medication processing (cell 3):** joins `df_meds.DRUG_CODE` (or `ITEM_CODE`) to `Medication Master.diabetes_drug_code`, pulls `drug_classification`, pivots on `CLAIM_CODE` with `aggfunc="max"`, renames each classification to `MED_<CLASSIFICATION>` → produces the 10 MED_ binary flags.
- **Complication processing (cell 5):** melts `DIAG_*` columns long, joins to `diabetes_list_of_complications.diabetes_diagnosis_code`, groups on `CLAIM_CODE` × `systemic` (the category field), pivots to the 5 `COMP_*` flags.
- **Merge (cell 7):** left-joins med flags + comp flags onto the base claims on `CLAIM_CODE`, fills NaN → 0, casts to int.
- Output: `step3_claims_meds_and_comps.xlsx`.
- **Naming contract:** any new MED_ / COMP_ flag added here will automatically flow through step 4 and land in `ml_ready_dataset.csv`. Downstream code discovers them by prefix match — **do not rename the prefixes**.

### 4.5 `04_aggregate_patients.ipynb` (4 code cells) — the most consequential file
- **Aggregation rules** (cell 3):
  - `SEX`: first
  - `AGE`: max (age at most recent visit)
  - `LOS` → `Avg_LOS`: **mean** (⚠ see §11)
  - `Is_IP` (derived from `"IP" in CLAIM_TYPE_CODE`) → `Num_Admissions`: sum
  - `CLAIM_CODE` → `Num_Visits`: count
  - All `MED_*` / `COMP_*`: max (patient-level presence)
- **Derived features** (cell 5):
  - `Readmitted_Yes_No = (Num_Admissions > 1)` — ⚠ This is the project's operational definition; **not a strict 30-day interval**. Flag this when defending the methodology.
  - `Admitted_Yes_No = (Num_Admissions > 0)`
  - `Total_Meds_Count = sum of MED_*`
  - `Complication_Yes_No = (sum of COMP_* > 0)`
  - `Total_Unique_Diagnoses`: cardinality of unique `DIAG_*` values per patient
- **SEVERITY_INDEX logic** (cell 5, overrides in order):
  1. Default: `Moderate`
  2. → `Mild` if `Total_Meds_Count == 0` **OR** (`MED_BIGUANIDE == 1 AND Total_Meds_Count == 1`)
  3. → `Severe` if `MED_INSULIN_THERAPY == 1` (insulin is the terminal override)
- **Finalization** (cell 7):
  - Generates anonymized `Patient_ID` = `"P" + zfill(5)` starting at `P00001`.
  - Saves `patient_id_key.xlsx` mapping `Patient_ID ↔ PATIENT_CODE` (the only reverse key).
  - Writes `step4_patient_aggregated.xlsx` with an **explicit column order** — preserve it if you edit.

### 4.6 `05_eda.ipynb` (7 plot cells)
- Writes to `../eda_plots/` (not committed).
- Plots: univariate numerical & categorical, bivariate by readmission & severity, correlation heatmap, complications/severity deep dive, normalized radar chart (readmitted vs not).
- Purely descriptive — no model dependencies.

### 4.7 `99_patient_lookup.ipynb`
- Interactive lookup (`input()` prompt) that resolves a `Patient_ID` back to `PATIENT_CODE` via `patient_id_key.xlsx`.
- **Do not run in automation** (blocking stdin).

### 4.8 `update_notebooks.py`
- Utility for rewriting markdown cell titles ("Chunk N: ..." / "### STEP X:") across the preprocessing notebooks.
- Strips emojis and legacy Gemini-era commentary.
- Standalone — run only when harmonizing notebook docs, not in the data pipeline.

---

## 5. `machineLearning/` — detailed pipeline

**Portable `base_path` convention** (every notebook + script):
```python
# Notebooks — Jupyter cwd is the notebook's folder (`<repo>/<track>/source code/`),
# so `parents[1]` resolves to the repo root.
base_path = os.environ.get("PROJECT_D_BASE", str(pathlib.Path(os.getcwd()).resolve().parents[1]))
# Scripts — `__file__` lives at `<repo>/diabetesDashboard/scripts/*.py`, so parents[2] is the repo root.
# (build_export.py / export_shap_plots.py use pathlib.Path(__file__).resolve().parents[2])
```
Override with the `PROJECT_D_BASE` env var when running outside the repo layout. The legacy Windows-absolute path (`C:\Users\thiranbarath\...`) has been fully removed from every notebook and script.

### 5.1 `01_ML_Data_Prep.ipynb` (8 cells — 4 code + 4 markdown step headers)
- Loads `step4_patient_aggregated.xlsx`.
- Encodes `SEVERITY_INDEX` → `Severity_Encoded` with `{Mild:0, Moderate:1, Severe:2}` and drops the text column.
- Drops `Patient_ID` (leakage / identifier).
- One-hot encodes `SEX` with `drop_first=True, dtype=int` → produces `SEX_M` (Male=1, Female=0).
- Writes `machineLearning/csv/ml_ready_dataset.csv` (26 cols, 62,135 rows).

### 5.2 `02_ML_Model_Admission.ipynb` — **Track A**
- **Target:** `Admitted_Yes_No`
- **Leakage columns dropped:** `Readmitted_Yes_No`, `Num_Admissions`, `Avg_LOS` (LOS only exists post-admission — cannot predict initial admission).
- **Feature count:** **22** continuous/binary (after leakage drop). The frozen list is persisted to `models/feature_names.csv` for the batch-export script.
- Stratified 80/20 split (`random_state=42`).
- Scaling: `ColumnTransformer` — `StandardScaler` on continuous (`AGE, Num_Visits, Total_Meds_Count, Total_Unique_Diagnoses, Severity_Encoded`), passthrough on binary.
- **Tuning:** `GridSearchCV` (LR) + `RandomizedSearchCV(n_iter=10, scoring='f1', cv=StratifiedKFold(3, shuffle=True, random_state=42))` for RF, XGB. Class imbalance: `class_weight='balanced'` for LR/RF, `scale_pos_weight = neg/pos ≈ 6.77` for XGB.
- **Threshold optimization (corrected):** F1-max over the PR curve, **learned on the TRAIN set, applied to the TEST set** (no leakage — matches Track B pattern).
- **Persisted artifacts** (written at the end of the notebook): `xgboost_admission.pkl`, `random_forest_admission.pkl`, `logistic_regression_admission.pkl`, `standard_scaler.pkl`, `feature_names.csv`, merged keys into `thresholds.json`, `model_metadata.txt`.
- **Results** (retrained 2026-04-21 with 22 features + train-learned thresholds, positive class):

| Model | Opt. Threshold | Precision | Recall | F1 | ROC-AUC | PR-AUC |
|---|---|---|---|---|---|---|
| Logistic Regression | 0.6199 | 0.44 | 0.58 | 0.50 | 0.8562 | 0.5031 |
| Random Forest | 0.6247 | 0.46 | 0.54 | 0.50 | 0.8590 | 0.5158 |
| **XGBoost (champion)** | **0.6873** | **0.45** | **0.57** | **0.51** | **0.8648** | **0.5344** |

- **Top SHAP drivers** (verified against `diabetesDashboard/public/data/shap_adm_importance.json`, top 5 by mean |SHAP|): `Total_Unique_Diagnoses`, `Total_Meds_Count`, `Num_Visits`, `AGE`, `SEX_M`.

### 5.3 `03_ML_Model_Readmission.ipynb` — **Track B**
- **Filter first:** `df_admitted = df[df.Admitted_Yes_No == 1]` → 7,999 patients.
- **Target:** `Readmitted_Yes_No`
- **Leakage dropped:** `Admitted_Yes_No`, `Num_Admissions`, `Num_Visits` (and `target`). `Avg_LOS` is retained as a clinical instability marker — **ablation confirms it carries temporal-leakage signal, see §11**.
- Scaling: same pattern as Track A but continuous cols now include `Avg_LOS`.
- **Tuning:** `GridSearchCV` for LR, `RandomizedSearchCV(n_iter=30)` for RF and XGB, CV as above, `scoring='f1'`. XGB does **not** use `scale_pos_weight` here (28% positive rate — less severe imbalance).
- **Threshold optimization:** F1-max on TRAIN proba, applied to TEST. (Track A now mirrors this pattern.)
- **Persisted:** `logistic_regression_readmission.pkl`, `random_forest_readmission.pkl`, `xgboost_readmission.pkl`, `standard_scaler_readmission.pkl`, merged keys into `thresholds.json` (including `xgb_readmission_noLOS`).
- **Results** (retrained 2026-04-21, positive class):

| Model | Opt. Threshold | Precision | Recall | F1 | ROC-AUC | PR-AUC |
|---|---|---|---|---|---|---|
| Logistic Regression | 0.2466 | 0.55 | 0.73 | 0.63 | 0.8220 | 0.6227 |
| Random Forest | 0.3938 | 0.67 | 0.68 | 0.68 | 0.8696 | 0.7414 |
| **XGBoost (champion)** | **0.3394** | **0.65** | **0.72** | **0.68** | **0.8757** | **0.7628** |
| XGBoost (no Avg_LOS ablation) | 0.3128 | 0.53 | 0.74 | 0.62 | **0.8131** | **0.6046** |

- **Ablation Δ (with vs without `Avg_LOS`):** ROC-AUC +0.0626, PR-AUC +0.1583 → over the 0.05 gate → Avg_LOS carries temporal-leakage signal. Both headline and honest-alternative numbers should appear in the capstone (§11).
- **Top SHAP drivers** (verified against `diabetesDashboard/public/data/shap_readm_importance.json`, top 5 by mean |SHAP|): `Total_Unique_Diagnoses`, `COMP_RETINOPATHY`, `Avg_LOS`, `AGE`, `Total_Meds_Count`.

### 5.4 `models/thresholds.json` — the single threshold source of truth
Written by both admission and readmission notebooks; they read-merge-write so neither clobbers the other's keys. `build_export.py` consumes this for gating predictions; a slim `{admission, readmission}` copy is mirrored to `diabetesDashboard/public/data/thresholds.json` for the React app. Current keys:
```json
{
  "lr_admission":   0.6199, "rf_admission":   0.6247, "xgb_admission":   0.6873,
  "lr_readmission": 0.2466, "rf_readmission": 0.3938, "xgb_readmission": 0.3394,
  "xgb_readmission_noLOS": 0.3128
}
```

### 5.5 `models/model_metadata.txt`
Snapshot of the most recent Track A run:
```
Training Date: 2026-04-21 02:38:26
Training Set Size: 49708
Test Set Size: 12427
Number of Features: 22
Target Variable: Admitted_Yes_No
Class Imbalance Ratio: 1:6.77
Hyperparameter Tuning: GridSearchCV (LR) + RandomizedSearchCV n_iter=10 (RF, XGB), StratifiedKFold(3)
Learned Thresholds (admission): LR=0.6199 RF=0.6247 XGB=0.6873
```
Metadata is regenerated automatically at the end of the admission notebook — keep it in sync on any retrain.

---

## 6. `diabetesDashboard/` — front-end and batch inference

### 6.1 Stack
- React **19.2.4**, Vite **8.0.1**, Recharts **3.8.1**, lucide-react **1.7.0**.
- Deployment: Vercel, connected to GitHub default branch.
- Fonts: Manrope (headings) + Inter (body) via Google Fonts.
- **No backend** — fully static, everything served from `public/data/`.

### 6.2 Component tree
```
main.jsx
└── App.jsx                              (tab router, fetches dashboard_payload.json)
    ├── EDAView.jsx          (tab: eda — default)
    └── PredictionsDirectory.jsx  (tab: predictions)
        └── PatientSlideOut.jsx  (modal overlay)
```

### 6.3 `dashboard_payload.json` contract
**~22 MB**, 62,135 records, pre-sorted descending by `Stage_1_Admission_Risk`. Each record (11 fields):

```ts
{
  Patient_ID: string,               // "P00018"
  Age: number,
  Sex: string,                      // "M" | "F" | "U"
  Severity: "Mild" | "Moderate" | "Severe",
  Avg_LOS: number,
  Total_Unique_Diagnoses: number,
  Stage_1_Admission_Risk: number,   // 0..1
  Predicted_Admission: 0 | 1,       // derived using thresholds["xgb_admission"] (0.6873) loaded from thresholds.json
  Stage_2_Readmission_Risk: number | null,  // null when Predicted_Admission == 0
  Top_Risk_Drivers: string[],       // ["COMP_NEPHROPATHY (+40.5%)", ...] — top 3 positive admission SHAP drivers
  Top_Readmission_Drivers: string[] | null  // top 3 positive readmission SHAP drivers; null when Predicted_Admission == 0
}
```
`Top_Risk_Drivers` and `Top_Readmission_Drivers` strings share the format `"FEATURE_NAME (+XX.X%)"`. They're parsed in React via `driver.split(' (+')[0]` to get the feature name and `parseFloat(parts[1].replace('%)', ''))` to get the impact magnitude — **do not change this format** without updating the React parsers ([EDAView.jsx](diabetesDashboard/src/components/EDAView.jsx), [PredictionsDirectory.jsx](diabetesDashboard/src/components/PredictionsDirectory.jsx), [PatientSlideOut.jsx](diabetesDashboard/src/components/PatientSlideOut.jsx)). Technical feature names map to clinical labels via [diabetesDashboard/src/featureLabels.js](diabetesDashboard/src/featureLabels.js).

### 6.4 `scripts/build_export.py` — canonical payload builder
- Loads `xgboost_admission.pkl`, `standard_scaler.pkl`, `feature_names.csv`, `xgboost_readmission.pkl`, `standard_scaler_readmission.pkl` from `machineLearning/models/`.
- Phase 1 (admission): scales `X_adm_raw[fn_adm]`, computes `adm_risk`, applies the canonical `thresholds["xgb_admission"]` (0.6873) from `thresholds.json` → `adm_pred`.
- Phase 2 (readmission): scales full frame minus leakage cols, computes `readm_risk`, masks to `NaN` where `adm_pred == 0`.
- Phase 3 (SHAP): full-batch `TreeExplainer.shap_values(X_adm_final)`. Per-patient top-3 positive drivers normalized as `(contribution / sum|contributions|) * 100 %`.
- Severity mapping: reads `Severity_Encoded` from `df_ml` and maps `{0,1,2} → {Mild, Moderate, Severe}` — **this is the authoritative severity source**, not the admission-risk-bucketed logic in `machineLearning/source code/04_Export_Dashboard_Payload.ipynb`.
- Writes `diabetesDashboard/public/data/dashboard_payload.json` (minified via `separators=(',',':')`).
- **Re-run after any model retraining or CSV regeneration.**

### 6.5 `scripts/export_shap_plots.py` — interactive SHAP JSON builder
- Fixed seed `random_state=42`, sample `n=3000` for the global importance plots — deterministic across re-runs.
- **Global importance** (top 15 features by mean |SHAP|) for both tracks → `shap_adm_importance.json`, `shap_readm_importance.json`.
- **Waterfall** (single highest-risk patient per track, features filtered `|shap| > 0.05`, sorted by `|shap|` desc) → `shap_adm_waterfall.json`, `shap_readm_waterfall.json`.
- Waterfall JSON schema:
```ts
{
  base_value: number,        // expected_value of the explainer (logit or proba space)
  prediction: number,        // predicted risk for that single patient
  data: [{ name, feature_value, shap }, ...]
}
```

### 6.6 `EDAView.jsx`
- **Stateless:** filter state is owned by [App.jsx](diabetesDashboard/src/App.jsx) and passed in as `filters` / `updateFilters` / `clearAllFilters`; EDAView holds no local state of its own. `data` and `thresholds` arrive as props; `onJumpToPredictions` switches the active tab to Predictions for cross-tab drill-down.
- **Derived via `useMemo`:**
  - `filteredData` — fully filtered cohort (all four dimensions: gender, severity, ageBand, riskBand).
  - `ageChartData` / `histChartData` / `matrixChartData` — per-chart "exclude self" data so an active band/cell doesn't make the chart collapse to one bar.
  - `metrics` — 3 KPIs: cohort count, avg admission risk %, **readmit rate = count(Stage_2 ≥ thresholds.readmission) / count(Predicted_Admission == 1)** within the filtered cohort.
  - `globalAvgRisk`, `globalPredictedAdmittedPct`, `cohortPredictedAdmittedPct` — full-dataset baselines used by the avg-risk delta caption and the cohort summary banner.
  - `ageRiskData` — 6 age buckets (`<40, 40-49, 50-59, 60-69, 70-79, 80+`).
  - `aggregatedDrivers` — counts of top-driver feature names across the filtered cohort, top 8.
  - `riskHistogramData` — 10 fixed 10-pt admission-risk bins (`0-10%, 10-20%, …, 90-100%`).
  - `severitySexMatrix` — 3×2 cells (Severity × Sex) with count + avg risk per cell, plus an `unknownSex` count.
- **Renders:** filter bar (gender + severity dropdowns) → `FilterChips` → cohort summary banner (when filters active and cohort > 0) → either an **empty-cohort panel** (when filters yield zero) or KPI grid + `Cohort Distribution` 2×2 chart grid (age band BarChart, cohort drivers, admission-risk histogram with threshold reference line, severity×sex matrix as a CSS-grid heatmap). All bars/cells are clickable for cross-filter (toggle on second click).
- **No SHAP panels.** Per-patient SHAP is surfaced via `PatientSlideOut` (driven by `Top_Risk_Drivers` and `Top_Readmission_Drivers` from the payload). The four SHAP JSON files generated by [export_shap_plots.py](diabetesDashboard/scripts/export_shap_plots.py) are still produced but no longer consumed by the UI — kept available for the final report.

### 6.7 `PredictionsDirectory.jsx` (~398 lines)
- **State:** `filter` (severity tab), `sortField` / `sortDesc`, `searchQuery`, `selectedPatient` / `isSlideOpen`, `viewMode` ('table' | 'grid'), `currentPage` (paginated at 50/page).
- **Table view:** sortable columns (ID, Severity, Stage 1, Stage 2), primary driver badge, click-to-open slideout.
- **Grid view:** top 20 cards only (explicit cap — `gridItems.slice(0, 20)`).
- **CSV export:** pulls all filtered records (not just the current page), filename `cohort_export_<filter>_sortedBy_<field>.csv`.

### 6.8 `PatientSlideOut.jsx` (~195 lines)
- Right-side drawer with: profile header, a 3-point "Risk Pulse Timeline" sparkline (Baseline 0% → Stage 1 → Stage 2), two risk-tile KPIs, and a horizontal bar chart of the top-3 drivers with the SHAP % impact.
- Accepts `patient`, `isOpen`, `onClose` props only — stateless beyond its mount/unmount animation.

### 6.9 Styling
- `index.css` defines a light-mode-only design system (`--bg-dark`, `--bg-card`, `--primary: #0284c7`, `--danger: #e11d48`, `--warning: #d97706`, `--success: #059669`). ⚠ The `--bg-dark` variable name is a legacy from the removed dark mode — it now refers to `#f0f4f8` (a light gray). Don't rename without a global sweep.
- The `App.css` Vite template was deleted in the reproducibility sweep — only `index.css` remains.

---

## 7. Research objectives (O1–O4) — status

| # | Objective | Status | Evidence |
|---|---|---|---|
| **O1** | Identify key predictors of admission & readmission | **Completed** | SHAP global importance JSONs, both TreeExplainer outputs |
| **O2** | Benchmark LR / RF / XGB — select best by AUPRC + AUROC | **Completed** | §5.2 and §5.3 tables; XGBoost champion for both tracks |
| **O3** | SHAP global + local interpretability in a lightweight interface | **Completed** | 4 SHAP JSONs, `EDAView` toggle panels, `PatientSlideOut` per-patient view |
| **O4** | Usability evaluation with 5–10 clinical / clinical-informatics experts | **Pending** | See §9 roadmap |

---

## 8. Benchmarking context (from the literature review & deep research)

**Track A (admission, AUC 0.865)** — no direct peer; admission prediction is rarely separated from readmission in the diabetes ML literature. Closest comparators: LACE-style hospital-level readmission models (AUC 0.65–0.75).

**Track B (readmission)** — two numbers to report, per the §11 ablation outcome:
- UCI 130-US Hospitals studies (Shang 2021, Emi-Johnson 2025, Liu 2024): AUC **0.58–0.67**
- Rich EHR data (Abdel Hai LSTM 2023, Temple): AUC **~0.79**
- ICU/administrative data (MIMIC-III Hu 2024, Alberta GBM): AUC **0.83–0.87**
- **This project (XGBoost, full feature set):** AUC **0.876** — comparable to the richest-data tier
- **This project (XGBoost, no Avg_LOS honest-alternative):** AUC **0.813** — still above UCI, below rich-EHR tier
- Single-center clinic studies (Mishra 2025, N=352): AUC 0.94 — flagged as likely overfit

**Drivers of the performance gap vs UCI benchmarks** (ranked by impact):
1. Feature richness (explicit complication flags, longitudinal visits, medication classes)
2. Higher positive-class rate (28% vs UCI 11%)
3. Patient-level aggregation (captures longitudinal signal absent in encounter-level UCI)
4. Malaysian population + insurance-captured utilization patterns

---

## 9. Roadmap to completion (Gantt-aligned)

Current stage: **Testing & Validation** (Apr 2026) → **Interface Development** (Apr–May 2026) → **Final Report** (May 2026).

### Open work items
1. **Frontend polish** — design / styling pass on the React dashboard. User parked this task on 2026-04-21; pick up in the next session. Backend (data pipeline, ML, payload, threshold wiring) is shipped.
2. **O4 usability study** — 5–10 experts, protocol in §3.7 of the research proposal. Produce:
   - Consent script + participant info sheet (IMU ethics)
   - Task sheet (3 structured tasks)
   - Post-task questionnaire (usefulness, clarity, trust — 5-pt Likert)
   - Think-aloud transcript template
   - Thematic synthesis
3. **Final report write-up** — methods, results, limitations, future work. 10-study lit comparison table is already in the research proposal. Must surface both Track B numbers (full + no-LOS) per §11, and frame the readmission target per §1's note + §13.

### Already shipped (no action needed)
- Reproducibility sweep + retrain on 22-feature pipeline + train-learned thresholds (2026-04-21).
- `Avg_LOS` temporal-leakage ablation (§11).
- Top-level `README.md`.
- Portable `base_path` across every notebook + script.
- Notebook docstring polish (`### Step N:` consistency, no placeholder text).

### Nice-to-haves (if time allows)
- CLI entry point wrapping `build_export.py` + `export_shap_plots.py` as a single `make dashboard` command.
- Unit tests on the preprocessing logic (especially `SEVERITY_INDEX` rules and `Readmitted_Yes_No` derivation).
- Replace the 18.9 MB `dashboard_payload.json` with a server-side paginated endpoint (future deployment consideration).
- Probability calibration on the dashboard scores (see §13).
- Bootstrapped 95% CIs on the headline AUCs (see §13).

---

## 10. Consistency / reproducibility audit — resolved 2026-04-21

All seven items from the original audit have been closed. Retained here for historical trace so future audits don't redo the work.

| # | Original issue | Resolution |
|---|---|---|
| 1 | Stale severity logic in `machineLearning/source code/04_Export_Dashboard_Payload.ipynb` | Notebook deleted. `build_export.py` is the canonical export path; severity is read from `Severity_Encoded`. |
| 2 | Hardcoded admission threshold `0.35` in `build_export.py` | Replaced with `thresholds["xgb_admission"]` (0.6873) loaded from `models/thresholds.json`. |
| 3 | Dashboard `readmitRate` KPI used `Stage_2 ≥ 0.5` instead of 0.347 | [App.jsx](diabetesDashboard/src/App.jsx) fetches `/data/thresholds.json` and passes it as a prop to every consumer. All `> 0.5` hardcoded cutoffs (`EDAView`, `PredictionsDirectory`, `PatientSlideOut`) now use `thresholds.admission` / `thresholds.readmission`. |
| 4 | Track A threshold optimized on **test** set | Rewritten to the Track B pattern: F1-max learned on TRAIN proba, applied to TEST. |
| 5 | `model_metadata.txt` reported stale `GridSearchCV`/5-folds | Regenerated at the end of `02_ML_Model_Admission.ipynb`; now faithful to current tuner + folds. |
| 6 | `App.jsx` imported `Sun, Moon` (dark-mode legacy) and used `AlertCircle` without importing it | Imports cleaned. |
| 7 | Dashboard `scripts/04_Export_Dashboard_Payload.ipynb` was a 2-cell stub | Deleted. |

---

## 11. ⚠ The `Avg_LOS` temporal-validity question (READ THIS)

**Observed fact:** `Avg_LOS` is computed as the **mean LOS across all claims for a patient** in `04_aggregate_patients.ipynb`. In Track B it is then used as a feature to predict `Readmitted_Yes_No = (Num_Admissions > 1)`.

**The concern:** If `Avg_LOS` is computed using **all** claims including the readmission encounter itself, the feature partially encodes the outcome — this is temporal leakage. The headline ROC-AUC of 0.876 would then be optimistic.

**Resolution (2026-04-21).** The ablation ran in the retrained Track B notebook. Result:
- Full XGBoost (with `Avg_LOS`): ROC-AUC **0.8757**, PR-AUC **0.7628**
- Ablated XGBoost (no `Avg_LOS`): ROC-AUC **0.8131**, PR-AUC **0.6046**
- **Δ ROC-AUC = +0.0626** (over the 0.05 leakage gate), Δ PR-AUC = +0.1583

**Decision — publish both numbers.** The production dashboard still uses the full model (higher sensitivity is clinically useful and the feature is real), but the final report must present both figures side-by-side in Results and explicitly call out the leakage risk in Limitations. `thresholds.json` retains `xgb_readmission_noLOS: 0.3128` for reproducibility.

**Future work.** The clinically-correct fix is temporal gating — recompute `Avg_LOS` in `04_aggregate_patients.ipynb` using only claims prior to the index admission, then retrain. Out of scope for this capstone submission; flagged in the report's Future Work section.

**Literature context.** LOS is the most-cited readmission predictor (LACE index, Emi-Johnson 2025, García-Mosquera 2025) — the *feature* is legitimate, but the *computation window* must be causally prior to the outcome.

---

## 12. Conventions for Claude Code when editing this repo

**Always:**
- Read the corresponding section above before touching a file.
- Preserve the MED_/COMP_ prefix contract — downstream discovery relies on it.
- Preserve the `Patient_ID` generation order (`P00001` onwards) — it is the join key to `patient_id_key.xlsx`.
- Preserve the `Top_Risk_Drivers` string format `"FEATURE_NAME (+XX.X%)"` — three React files parse it.
- When changing model thresholds, update `build_export.py`, `EDAView.jsx`'s `metrics` memo, and `model_metadata.txt` together.
- When adding a feature, rerun **in order**: `03_feature_engineering.ipynb` → `04_aggregate_patients.ipynb` → `01_ML_Data_Prep.ipynb` → Track A → Track B → `build_export.py` → `export_shap_plots.py`.

**Never:**
- Never run `99_patient_lookup.ipynb` in automation (interactive `input()`).
- Never rename `MED_*`, `COMP_*`, or target columns without a global sweep.
- Never delete `patient_id_key.xlsx` or `ml_ready_dataset.csv` — they are the only artifacts the dashboard reproduces from.
- Never reintroduce a Windows-absolute `base_path` — all scripts are now portable via `pathlib` + `PROJECT_D_BASE` env var.
- Never bypass the provider blacklist in `01_clean_and_filter_claims.py` — it removes non-clinical pharmacy rows essential to the admission definition.
- Never overwrite `machineLearning/models/thresholds.json` with a single-track write — both notebooks read-merge-write so the admission and readmission keys coexist.

**When in doubt:**
- The canonical severity source is `ml_ready_dataset.csv.Severity_Encoded`, mapped via `{0: Mild, 1: Moderate, 2: Severe}`.
- The canonical payload builder is `diabetesDashboard/scripts/build_export.py`.
- The canonical Track B threshold is `0.3394` (XGBoost optimal, train-learned) — everything else is either legacy or a dashboard display heuristic. The companion no-LOS ablation threshold is `0.3128`.
- Dataset size assertions: 62,135 patients, 7,999 admitted, 2,228 readmitted globally — any deviation after a pipeline re-run is a red flag.

---

## 13. Known pipeline limitations (cite in Limitations / Future Work)

Catalogued so future audits don't re-derive them. Tier 1 = examiner will probe; Tier 2 = footnote in the writeup.

### Tier 1 — substantive

1. **`Avg_LOS` temporal leakage in Track B headline.** Documented + ablation already done (§11). Headline 0.8757 is mitigated by also publishing 0.8131; the *fix* (recompute LOS using only pre-index claims) is queued as Future Work.
2. **Target ≠ standard 30-day readmission.** Per §1, `Readmitted_Yes_No = Num_Admissions > 1` is all-cause recurrent admission, not a 30-day window. AUC comparisons against UCI/LACE/MIMIC-III need an explicit "different target definition" caveat.
3. **No probability calibration.** Dashboard surfaces `Stage_1_Admission_Risk` as a percentage but the underlying XGBoost score is uncalibrated. A `CalibratedClassifierCV` wrap + reliability diagram would close this.
4. **No confidence intervals on AUCs.** Single 80/20 split → point estimates only. No bootstrap, no nested CV, no seed-robustness check.
5. **No external or temporal validation.** Train and test from the same TPA, same population, same window.

### Tier 2 — methodology footnotes

6. `Num_Visits` retained in Track A. Partially correlates with the admission target (every admitted patient generates inpatient claims that count toward visits).
7. Track A hyperparameter search budget is small (`n_iter=10`); Track B uses `n_iter=30`. Inconsistent.
8. F1-max threshold ignores cost asymmetry (false negatives are typically costlier than false positives in clinical risk-flagging).
9. Track A positive-class precision = 0.45 — 55% of "will-be-admitted" predictions are wrong at the operating threshold. Real number, needs explicit acknowledgement in dashboard usability framing.
10. Severity index is a clinically-motivated heuristic (insulin → Severe, biguanide-only → Mild) not validated against HbA1c / Charlson.
11. Description-to-ICD mapping is exact-string-match — silent misses on casing/wording variants.
12. Provider blacklist (`SUPP343 / PHAR455 / PHAR588 / KPJ036`) is hardcoded with no documented rationale beyond "pharmacy/supplier".
13. `Avg_LOS = mean(LOS)` across all claim types — outpatient claims with LOS=0 dilute the inpatient signal.
14. No requirements.txt / lockfile, no unit tests on `SEVERITY_INDEX` or `Readmitted_Yes_No` derivation, no subgroup performance breakdown.

### NOT flaws (common pushbacks worth pre-empting)

- Threshold learned on TRAIN, applied to TEST → methodologically correct.
- `scale_pos_weight` (XGB) / `class_weight='balanced'` (LR, RF) → standard imbalance handling.
- 22-feature pipeline → synced between notebook, scaler, and dashboard.
- Stratified 80/20 split + 3-fold CV on the search → standard practice.
- Three-model bake-off → appropriate scope for dataset size and capstone level.

---

*Last updated: 2026-05-04 (CLAUDE.md cleanup: corrected stale SHAP drivers, fixed `Predicted_Admission` derivation comment, fixed canonical Track B threshold `0.3471 → 0.3394`, removed shipped roadmap items, added §13 known-flaws inventory). Maintained alongside the `BDH2372 Research Project II` submission.*

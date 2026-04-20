# CLAUDE.md — Project D: AI-Assisted Diabetes Admission & Readmission Risk Pipeline

> Context file for Claude Code (VS Code extension). Read this **first** before editing, auditing, or extending any part of this repository.

---

## 1. Project identity

**Owner:** Thiranbarath (student ID `00000042906`), IMU University, Bachelor in Digital Health (Hons), final-year capstone `BDH2372 Research Project II`.

**One-line purpose:** Develop, interpret, and surface XGBoost-based risk scores for (A) initial hospital admission and (B) 30-day-style readmission in Malaysian Type-2 diabetes patients, using a real-world PMCare Third-Party-Administrator claims extract, and expose the results through a React expert-review dashboard for formative usability evaluation.

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
│   ├── source code/                # 4 Jupyter notebooks
│   ├── csv/ml_ready_dataset.csv    # 62,135 × 26 — committed (whitelisted)
│   ├── models/model_metadata.txt   # Training-run provenance
│   └── plots/                      # Classification reports + ROC/confusion PNGs
├── diabetesDashboard/              # React + Vite front-end (deployed on Vercel)
│   ├── src/                        # App + 3 components
│   ├── public/data/                # 5 pre-computed JSON payloads
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

**Hardcoded path** (appears in every notebook): `base_path = r"C:\Users\thiranbarath\Documents\GitHub\project-d"`. When Claude Code edits these notebooks on a new machine, **parameterize via env var or `pathlib.Path(__file__)`** — don't silently change this string without flagging.

### 5.1 `01_ML_Data_Prep.ipynb` (4 cells)
- Loads `step4_patient_aggregated.xlsx`.
- Encodes `SEVERITY_INDEX` → `Severity_Encoded` with `{Mild:0, Moderate:1, Severe:2}` and drops the text column.
- Drops `Patient_ID` (leakage / identifier).
- One-hot encodes `SEX` with `drop_first=True, dtype=int` → produces `SEX_M` (Male=1, Female=0).
- Writes `machineLearning/csv/ml_ready_dataset.csv` (26 cols, 62,135 rows).

### 5.2 `02_ML_Model_Admission.ipynb` — **Track A** (21 cells)
- **Target:** `Admitted_Yes_No`
- **Leakage columns dropped:** `Readmitted_Yes_No`, `Num_Admissions`, `Avg_LOS` (LOS only exists post-admission — cannot predict initial admission).
- **Feature count:** 14 continuous/binary (after leakage drop). The frozen list is persisted to `models/feature_names.csv` for the batch-export script.
- Stratified 80/20 split (`random_state=42`).
- Scaling: `ColumnTransformer` — `StandardScaler` on continuous (`AGE, Num_Visits, Total_Meds_Count, Total_Unique_Diagnoses, Severity_Encoded`), passthrough on binary.
- **Tuning:** `RandomizedSearchCV(n_iter=10, scoring='f1', cv=StratifiedKFold(3, shuffle=True, random_state=42))` for LR, RF, XGB. Class imbalance: `class_weight='balanced'` for LR/RF, `scale_pos_weight = neg/pos ≈ 6.77` for XGB.
- **Threshold optimization (cell 11):** F1-max over the PR curve — ⚠ **computed on the TEST set** (leakage). Compare with Track B's corrected logic below.
- **Persisted artifacts** (via a later export path — see `build_export.py`): `xgboost_admission.pkl`, `standard_scaler.pkl`, `feature_names.csv`, plus sibling LR/RF pickles.
- **Results** (from `plots/01_Admission_Classification_Reports.txt`, positive class):

| Model | Precision | Recall | F1 | ROC-AUC | PR-AUC |
|---|---|---|---|---|---|
| Logistic Regression | 0.44 | 0.58 | 0.50 | 0.856 | 0.503 |
| Random Forest | 0.44 | 0.58 | 0.51 | 0.859 | 0.516 |
| **XGBoost (champion)** | **0.45** | **0.60** | **0.51** | **0.865** | **0.533** |

- **Top SHAP drivers:** `COMP_NEPHROPATHY`, `MED_COMBINATION_DRUG`, `Num_Visits`, `AGE`.

### 5.3 `03_ML_Model_Readmission.ipynb` — **Track B** (18 cells)
- **Filter first:** `df_admitted = df[df.Admitted_Yes_No == 1]` → 7,999 patients.
- **Target:** `Readmitted_Yes_No`
- **Leakage dropped:** `Admitted_Yes_No`, `Num_Admissions`, `Num_Visits` (and `target`). `Avg_LOS` is **retained** as a clinical instability marker (see §11).
- Scaling: same pattern as Track A but continuous cols now include `Avg_LOS`.
- **Tuning:** `GridSearchCV` for LR, `RandomizedSearchCV(n_iter=30)` for RF and XGB, CV as above, `scoring='f1'`. XGB does **not** use `scale_pos_weight` here (28% positive rate — less severe imbalance).
- **Threshold optimization (cell 10): CORRECT — learned on train proba, applied to test.** This is the methodologically-right pattern; Track A should be updated to match.
- **Persisted:** `logistic_regression_readmission.pkl`, `random_forest_readmission.pkl`, `xgboost_readmission.pkl`, `standard_scaler_readmission.pkl`.
- **Results** (cell 10 output, positive class):

| Model | Opt. Threshold | Precision | Recall | F1 | ROC-AUC | PR-AUC |
|---|---|---|---|---|---|---|
| Logistic Regression | 0.2466 | 0.55 | 0.73 | 0.63 | 0.8220 | 0.6227 |
| Random Forest | 0.3938 | 0.67 | 0.68 | 0.68 | 0.8696 | 0.7414 |
| **XGBoost (champion)** | **0.3471** | **0.65** | **0.74** | **0.69** | **0.8757** | **0.7671** |

- **Top SHAP drivers:** `Total_Unique_Diagnoses`, `Avg_LOS`, `COMP_RETINOPATHY`, `COMP_NEPHROPATHY`, `AGE`.

### 5.4 `04_Export_Dashboard_Payload.ipynb` (7 cells) — ⚠ **STALE, DO NOT RUN**
This notebook contains an **obsolete severity mapping** based on risk thresholds (`Critical` / `High`) that conflicts with the canonical `Severity_Encoded` → {Mild, Moderate, Severe} used by the actual dashboard. The canonical export path is `diabetesDashboard/scripts/build_export.py` (see §6.4). See audit item #1 in §10.

### 5.5 `models/model_metadata.txt`
Snapshot of the last successful Track A run:
```
Training Date: 2026-03-02 10:41:01
Training Set Size: 49708
Test Set Size: 12427
Number of Features: 14
Target Variable: Admitted_Yes_No
Class Imbalance Ratio: 1:6.77
Hyperparameter Tuning: GridSearchCV with StratifiedKFold (5 folds)
Models Trained: ['Logistic Regression', 'Random Forest', 'XGBoost']
```
⚠ Metadata claims `GridSearchCV` and `5 folds` but the current notebook uses `RandomizedSearchCV` and `3 folds`. Regenerate metadata after the next training run to remove this inconsistency.

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
**18.9 MB**, 62,135 records, pre-sorted descending by `Stage_1_Admission_Risk`. Each record:

```ts
{
  Patient_ID: string,               // "P00018"
  Age: number,
  Sex: string,                      // "M" | "F" | "U"
  Severity: "Mild" | "Moderate" | "Severe",
  Avg_LOS: number,
  Total_Unique_Diagnoses: number,
  Stage_1_Admission_Risk: number,   // 0..1
  Predicted_Admission: 0 | 1,       // derived using threshold = 0.35
  Stage_2_Readmission_Risk: number | null,  // null when Predicted_Admission == 0
  Top_Risk_Drivers: string[]        // ["COMP_NEPHROPATHY (+40.5%)", ...] — top 3 positive
}
```
`Top_Risk_Drivers` strings are parsed in React via `driver.split(' (+')[0]` to get feature name and `parseFloat(parts[1].replace('%)', ''))` to get impact magnitude — **do not change this format** without updating `EDAView.jsx` (line ~110), `PredictionsDirectory.jsx` (line ~160), and `PatientSlideOut.jsx` (line ~22).

### 6.4 `scripts/build_export.py` — canonical payload builder
- Loads `xgboost_admission.pkl`, `standard_scaler.pkl`, `feature_names.csv`, `xgboost_readmission.pkl`, `standard_scaler_readmission.pkl` from `machineLearning/models/`.
- Phase 1 (admission): scales `X_adm_raw[fn_adm]`, computes `adm_risk`, applies **hardcoded threshold 0.35** → `adm_pred`. ⚠ This is **not** the train-learned optimal (which was different per model) — see audit item #2 in §10.
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

### 6.6 `EDAView.jsx` (462 lines)
- **State:** `filterGender`, `filterSeverity`, `activeAdmTab` / `activeReadmTab` ('beeswarm' | 'waterfall'), `shapData` (loaded once on mount from the 4 SHAP JSON files).
- **Derived via `useMemo`:**
  - `filteredData` — applies gender + severity filters to `data` prop.
  - `metrics` — 3 KPIs: cohort count, avg admission risk %, **readmit rate among admitted = count(Stage_2 ≥ 0.5) / count(Predicted_Admission == 1)**. ⚠ The 0.5 cutoff here is an arbitrary dashboard-display threshold, not the XGB-learned 0.347 — see audit item #3 in §10.
  - `ageRiskData` — 6 age buckets (`<40, 40-49, 50-59, 60-69, 70-79, 80+`).
  - `aggregatedDrivers` — counts of top-driver feature names across the filtered cohort, top 8.
  - `losRiskData` — mean `Avg_LOS` per Severity level (Mild/Moderate/Severe).
- **Renders:** global filter bar → 3 KPI cards → 3 Recharts (AreaChart for age, vertical BarChart for drivers, BarChart for LOS) → 2 SHAP panels (admission + readmission) each with a toggle between the global importance chart and the waterfall.

### 6.7 `PredictionsDirectory.jsx` (397 lines)
- **State:** `filter` (severity tab), `sortField` / `sortDesc`, `searchQuery`, `selectedPatient` / `isSlideOpen`, `viewMode` ('table' | 'grid'), `currentPage` (paginated at 50/page).
- **Table view:** sortable columns (ID, Severity, Stage 1, Stage 2), primary driver badge, click-to-open slideout.
- **Grid view:** top 20 cards only (explicit cap — `gridItems.slice(0, 20)`).
- **CSV export:** pulls all filtered records (not just the current page), filename `cohort_export_<filter>_sortedBy_<field>.csv`.

### 6.8 `PatientSlideOut.jsx` (181 lines)
- Right-side drawer with: profile header, a 3-point "Risk Pulse Timeline" sparkline (Baseline 0% → Stage 1 → Stage 2), two risk-tile KPIs, and a horizontal bar chart of the top-3 drivers with the SHAP % impact.
- Accepts `patient`, `isOpen`, `onClose` props only — stateless beyond its mount/unmount animation.

### 6.9 Styling
- `index.css` defines a light-mode-only design system (`--bg-dark`, `--bg-card`, `--primary: #0284c7`, `--danger: #e11d48`, `--warning: #d97706`, `--success: #059669`). ⚠ The `--bg-dark` variable name is a legacy from the removed dark mode — it now refers to `#f0f4f8` (a light gray). Don't rename without a global sweep.
- `App.css` is largely legacy Vite template code — safe to delete once confirmed unused.

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

**Track B (readmission, AUC 0.876)** — sits in the top performance tier for non-UCI datasets:
- UCI 130-US Hospitals studies (Shang 2021, Emi-Johnson 2025, Liu 2024): AUC **0.58–0.67**
- Rich EHR data (Abdel Hai LSTM 2023, Temple): AUC **~0.79**
- ICU/administrative data (MIMIC-III Hu 2024, Alberta GBM): AUC **0.83–0.87**
- **This project (XGBoost):** AUC **0.876** — comparable to the richest-data tier
- Single-center clinic studies (Mishra 2025, N=352): AUC 0.94 — flagged as likely overfit

**Drivers of the performance gap vs UCI benchmarks** (ranked by impact):
1. Feature richness (explicit complication flags, longitudinal visits, medication classes)
2. Higher positive-class rate (28% vs UCI 11%)
3. Patient-level aggregation (captures longitudinal signal absent in encounter-level UCI)
4. Malaysian population + insurance-captured utilization patterns

---

## 9. Roadmap to completion (Gantt-aligned)

Current stage: **Testing & Validation** (Apr 2026) → **Interface Development** (Apr–May 2026) → **Final Report** (May 2026).

### Critical pre-submission work items
1. **`Avg_LOS` temporal-leakage ablation** (§11) — must be done before performance claims are finalized.
2. **O4 usability study** — 5–10 experts, protocol in §3.7 of the research proposal. Produce:
   - Consent script + participant info sheet (IMU ethics)
   - Task sheet (3 structured tasks)
   - Post-task questionnaire (usefulness, clarity, trust — 5-pt Likert)
   - Think-aloud transcript template
   - Thematic synthesis
3. **Reproducibility sweep** — address all 6 audit items in §10.
4. **Final report write-up** — methods, results, limitations, future work. 10-study lit comparison table is already in the research proposal.
5. **README.md at repo root** — currently only `diabetesDashboard/README.md` exists (boilerplate Vite). Need a top-level README describing setup, pipeline order, and how to reproduce.

### Nice-to-haves (if time allows)
- CLI entry point wrapping `build_export.py` + `export_shap_plots.py` as a single `make dashboard` command.
- Unit tests on the preprocessing logic (especially `SEVERITY_INDEX` rules and `Readmitted_Yes_No` derivation).
- Parameterize `base_path` via a `.env` to make the pipeline portable off the Windows machine.
- Replace the 18.9 MB `dashboard_payload.json` with a server-side paginated endpoint (future deployment consideration).

---

## 10. Consistency / reproducibility audit — known issues

| # | Issue | Location | Severity | Fix |
|---|---|---|---|---|
| 1 | Stale severity logic (Critical/High thresholds) in an unused notebook that conflicts with canonical `Severity_Encoded` | `machineLearning/source code/04_Export_Dashboard_Payload.ipynb` | High — reproducibility trap | Delete or replace with a wrapper call to `build_export.py` |
| 2 | Hardcoded admission threshold `0.35` in `build_export.py` doesn't match the train-learned optimal | `diabetesDashboard/scripts/build_export.py` line ~38 | Medium | Export optimal thresholds per model from notebooks to `models/thresholds.json` and load here |
| 3 | Dashboard `readmitRate` KPI uses `Stage_2 ≥ 0.5` instead of the model-selected 0.347 | `EDAView.jsx` line ~62 | Medium | Load threshold from config, apply consistently |
| 4 | Track A threshold optimized on **test** set (§5.2) — minor leakage | `02_ML_Model_Admission.ipynb` cell 11 | Medium | Mirror Track B's train-optimized pattern |
| 5 | `model_metadata.txt` reports `GridSearchCV` + 5 folds; notebooks use `RandomizedSearchCV` + 3 folds | `models/model_metadata.txt` | Low | Regenerate after next training run |
| 6 | `App.jsx` imports `Sun, Moon` icons (dark-mode legacy); references `AlertCircle` in JSX without importing it | `App.jsx` lines 3, ~90 | Low — dead code / runtime-error-if-empty-data | Clean imports; add `AlertCircle` to import list |
| 7 | Dashboard `scripts/04_Export_Dashboard_Payload.ipynb` is a 2-cell stub | `diabetesDashboard/scripts/04_Export_Dashboard_Payload.ipynb` | Low | Populate with actual cells mirroring `build_export.py`, or delete |

---

## 11. ⚠ The `Avg_LOS` temporal-validity question (READ THIS)

**Observed fact:** `Avg_LOS` is computed as the **mean LOS across all claims for a patient** in `04_aggregate_patients.ipynb`. In Track B it is then used as a feature to predict `Readmitted_Yes_No = (Num_Admissions > 1)`.

**The concern:** If `Avg_LOS` is computed using **all** claims including the readmission encounter itself, the feature partially encodes the outcome — this is temporal leakage. The headline ROC-AUC of 0.876 would then be optimistic.

**The mitigation plan:** Before finalizing performance claims, run an **ablation**:
1. Retrain Track B with `Avg_LOS` **removed** from the feature set.
2. Report delta AUC/PR-AUC.
3. If ΔAUC is large (>0.05), regenerate the dashboard payloads with the Avg_LOS-free model and update the report to present both numbers honestly.
4. Alternatively: recompute `Avg_LOS` using only claims **prior to** the index admission (temporal gating), and rerun with the gated feature — this is the clinically-correct version.

**Literature context:** LOS is the most-cited readmission predictor (LACE index, Emi-Johnson 2025, García-Mosquera 2025) — the *feature* is legitimate, but the *computation window* must be causally prior to the outcome. Document the decision clearly in the final report either way.

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
- Never run `machineLearning/source code/04_Export_Dashboard_Payload.ipynb` — it's stale (audit item #1).
- Never rename `MED_*`, `COMP_*`, or target columns without a global sweep.
- Never delete `patient_id_key.xlsx` or `ml_ready_dataset.csv` — they are the only artifacts the dashboard reproduces from.
- Never hardcode a new Windows-absolute `base_path` without noting it for cross-machine portability.
- Never bypass the provider blacklist in `01_clean_and_filter_claims.py` — it removes non-clinical pharmacy rows essential to the admission definition.

**When in doubt:**
- The canonical severity source is `ml_ready_dataset.csv.Severity_Encoded`, mapped via `{0: Mild, 1: Moderate, 2: Severe}`.
- The canonical payload builder is `diabetesDashboard/scripts/build_export.py`.
- The canonical Track B threshold is `0.3471` (XGBoost optimal) — everything else is either legacy or a dashboard display heuristic.
- Dataset size assertions: 62,135 patients, 7,999 admitted, 2,228 readmitted globally — any deviation after a pipeline re-run is a red flag.

---

*Last updated: 2026-04-21. Maintained alongside the `BDH2372 Research Project II` submission.*

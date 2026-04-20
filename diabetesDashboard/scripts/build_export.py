import json
import os
import pathlib
import pandas as pd
import numpy as np
import joblib
import shap
import time

# Portable repo root resolution — works on any machine without editing.
# Override via env var PROJECT_D_BASE if running outside the repo layout.
base_path = os.environ.get(
    "PROJECT_D_BASE",
    str(pathlib.Path(__file__).resolve().parents[2])
)

out_file = os.path.join(base_path, 'diabetesDashboard', 'public', 'data', 'dashboard_payload.json')
os.makedirs(os.path.dirname(out_file), exist_ok=True)

print(f"Using base_path: {base_path}")
print("Loading data for Full-Batch Execution (62,135 patients)...")
ml_data_path = os.path.join(base_path, 'machineLearning', 'csv', 'ml_ready_dataset.csv')
patient_data_path = os.path.join(base_path, 'dataPreprocessing', 'csv', 'step4_patient_aggregated.xlsx')
model_dir = os.path.join(base_path, 'machineLearning', 'models')

df_ml = pd.read_csv(ml_data_path)
df_patient = pd.read_excel(patient_data_path)

print("Loading Models...")
xgb_admission = joblib.load(os.path.join(model_dir, 'xgboost_admission.pkl'))
scaler_admission = joblib.load(os.path.join(model_dir, 'standard_scaler.pkl'))
xgb_readmission = joblib.load(os.path.join(model_dir, 'xgboost_readmission.pkl'))
scaler_readmission = joblib.load(os.path.join(model_dir, 'standard_scaler_readmission.pkl'))
fn_adm = pd.read_csv(os.path.join(model_dir, 'feature_names.csv'))['features'].tolist()

# Load canonical thresholds learned by the notebooks (train-optimized F1-max).
# Keys: lr_admission / rf_admission / xgb_admission / lr_readmission / rf_readmission / xgb_readmission
# The dashboard only consumes the XGBoost champions for both tracks.
thresholds_path = os.path.join(model_dir, 'thresholds.json')
with open(thresholds_path) as f:
    thresholds = json.load(f)

print(f"Loaded thresholds: xgb_admission={thresholds['xgb_admission']:.4f} xgb_readmission={thresholds['xgb_readmission']:.4f}")

# Emit a slim thresholds file for the React app so the KPI cutoffs live in one place.
dash_thresholds = {
    "admission": float(thresholds["xgb_admission"]),
    "readmission": float(thresholds["xgb_readmission"]),
}
dash_thresholds_path = os.path.join(base_path, 'diabetesDashboard', 'public', 'data', 'thresholds.json')
with open(dash_thresholds_path, 'w') as f:
    json.dump(dash_thresholds, f)
print(f"Wrote dashboard thresholds.json: {dash_thresholds}")

print("Phase 1: Admission Processing...")
start_time = time.time()
X_adm_raw = df_ml[fn_adm].copy()
continuous_cols_adm = ['AGE', 'Num_Visits', 'Total_Meds_Count', 'Total_Unique_Diagnoses', 'Severity_Encoded']
binary_cols_adm = [c for c in X_adm_raw.columns if c not in continuous_cols_adm]
X_adm_scaled = scaler_admission.transform(X_adm_raw)
X_adm_final = pd.DataFrame(X_adm_scaled, columns=continuous_cols_adm + binary_cols_adm, index=X_adm_raw.index)

adm_risk = xgb_admission.predict_proba(X_adm_final)[:, 1]
adm_pred = (adm_risk >= thresholds["xgb_admission"]).astype(int)
print(f"Admission processing done in {time.time()-start_time:.1f}s (positives: {int(adm_pred.sum())})")

print("Phase 2: Readmission Processing...")
start_time = time.time()
leakage_cols_readm = ['Admitted_Yes_No', 'Num_Admissions', 'Num_Visits', 'Readmitted_Yes_No']
X_readm_raw = df_ml.drop(columns=[c for c in leakage_cols_readm if c in df_ml.columns], errors='ignore')
continuous_cols_readm = ['AGE', 'Avg_LOS', 'Total_Meds_Count', 'Total_Unique_Diagnoses', 'Severity_Encoded']
binary_cols_readm = [c for c in X_readm_raw.columns if c not in continuous_cols_readm]
X_readm_scaled = scaler_readmission.transform(X_readm_raw)
X_readm_final = pd.DataFrame(X_readm_scaled, columns=continuous_cols_readm + binary_cols_readm, index=X_readm_raw.index)

readm_risk = xgb_readmission.predict_proba(X_readm_final)[:, 1]
readm_risk = np.where(adm_pred == 1, readm_risk, np.nan)
print(f"Readmission processing done in {time.time()-start_time:.1f}s")

print("Phase 3: Deep SHAP Parsing for full dataset (this may take 1-3 minutes)...")
start_time = time.time()
explainer_adm = shap.TreeExplainer(xgb_admission)
shap_values_adm = explainer_adm.shap_values(X_adm_final)
print(f"SHAP calculations finished in {time.time()-start_time:.1f}s")

def get_top_features_fast(patient_idx, shap_vals, feature_names):
    contributions = shap_vals[patient_idx]
    top_idx = np.argsort(contributions)[-3:][::-1]
    top_features = []
    base_sum = np.abs(contributions).sum() + 1e-9
    for i in top_idx:
        if contributions[i] > 0:
            impact = (contributions[i] / base_sum) * 100
            top_features.append(f'{feature_names[i]} (+{impact:.1f}%)')
    return top_features

print("Assembling the massive JSON payload...")
start_time = time.time()
payload = []
feature_names = X_adm_final.columns.tolist()

severity_map = {0: 'Mild', 1: 'Moderate', 2: 'Severe'}
severity_col = df_ml['Severity_Encoded'].values

for idx in range(len(df_patient)):
    pid = df_patient.loc[idx, 'Patient_ID']
    age = int(df_patient.loc[idx, 'AGE'])
    sex = str(df_patient.loc[idx, 'SEX'])

    encoded_sev = severity_col[idx]
    severity_str = severity_map.get(encoded_sev, 'Unknown')

    top_drivers = get_top_features_fast(idx, shap_values_adm, feature_names)

    avg_los = float(df_ml.loc[idx, 'Avg_LOS']) if 'Avg_LOS' in df_ml.columns else 0.0
    total_dx = int(df_ml.loc[idx, 'Total_Unique_Diagnoses']) if 'Total_Unique_Diagnoses' in df_ml.columns else 0

    record = {
        'Patient_ID': str(pid),
        'Age': age,
        'Sex': sex,
        'Severity': severity_str,
        'Avg_LOS': avg_los,
        'Total_Unique_Diagnoses': total_dx,
        'Stage_1_Admission_Risk': float(adm_risk[idx]),
        'Predicted_Admission': int(adm_pred[idx]),
        'Stage_2_Readmission_Risk': float(readm_risk[idx]) if not np.isnan(readm_risk[idx]) else None,
        'Top_Risk_Drivers': top_drivers
    }
    payload.append(record)

payload.sort(key=lambda x: x['Stage_1_Admission_Risk'], reverse=True)

print(f"Payload assembly done in {time.time()-start_time:.1f}s. Preparing JSON serialization...")
with open(out_file, 'w') as f:
    json.dump(payload, f, separators=(',', ':'))

print(f"Exported {len(payload)} records to {out_file}")

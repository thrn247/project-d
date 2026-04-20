import os
import pathlib
import pandas as pd
import numpy as np
import joblib
import shap
import json

# Portable repo root resolution — works on any machine without editing.
# Override via env var PROJECT_D_BASE if running outside the repo layout.
base_path = os.environ.get(
    "PROJECT_D_BASE",
    str(pathlib.Path(__file__).resolve().parents[2])
)
model_dir = os.path.join(base_path, 'machineLearning', 'models')
json_out_dir = os.path.join(base_path, 'diabetesDashboard', 'public', 'data')
os.makedirs(json_out_dir, exist_ok=True)

print("Loading dataset for SHAP plots...")
ml_data_path = os.path.join(base_path, 'machineLearning', 'csv', 'ml_ready_dataset.csv')
df_ml = pd.read_csv(ml_data_path)

print("Loading Pickles...")
xgb_admission = joblib.load(os.path.join(model_dir, 'xgboost_admission.pkl'))
scaler_admission = joblib.load(os.path.join(model_dir, 'standard_scaler.pkl'))
xgb_readmission = joblib.load(os.path.join(model_dir, 'xgboost_readmission.pkl'))
scaler_readmission = joblib.load(os.path.join(model_dir, 'standard_scaler_readmission.pkl'))

fn_adm = pd.read_csv(os.path.join(model_dir, 'feature_names.csv'))['features'].tolist()

# Prepare Admission Data
X_adm_raw = df_ml[fn_adm].copy()
continuous_cols_adm = ['AGE', 'Num_Visits', 'Total_Meds_Count', 'Total_Unique_Diagnoses', 'Severity_Encoded']
binary_cols_adm = [c for c in X_adm_raw.columns if c not in continuous_cols_adm]
X_adm_scaled = scaler_admission.transform(X_adm_raw)
X_adm_final = pd.DataFrame(X_adm_scaled, columns=continuous_cols_adm + binary_cols_adm, index=X_adm_raw.index)

# Prepare Readmission Data
leakage_cols_readm = ['Admitted_Yes_No', 'Num_Admissions', 'Num_Visits', 'Readmitted_Yes_No']
X_readm_raw = df_ml.drop(columns=[c for c in leakage_cols_readm if c in df_ml.columns], errors='ignore')
continuous_cols_readm = ['AGE', 'Avg_LOS', 'Total_Meds_Count', 'Total_Unique_Diagnoses', 'Severity_Encoded']
binary_cols_readm = [c for c in X_readm_raw.columns if c not in continuous_cols_readm]
X_readm_scaled = scaler_readmission.transform(X_readm_raw)
X_readm_final = pd.DataFrame(X_readm_scaled, columns=continuous_cols_readm + binary_cols_readm, index=X_readm_raw.index)

# Standardized Reproducible Extraction! No more random Vercel Discrepancies
X_adm_sample = X_adm_final.sample(n=3000, random_state=42)
X_readm_sample = X_readm_final.sample(n=3000, random_state=42)

print("Calculating Admission Explainers...")
explainer_adm = shap.TreeExplainer(xgb_admission)
shap_values_adm = explainer_adm.shap_values(X_adm_sample)

# Global Admission Feature Importance
print("Exporting Admission Global SHAP...")
mean_abs_shap_adm = np.abs(shap_values_adm).mean(axis=0)
imp_adm = pd.DataFrame({'feature': X_adm_final.columns, 'mean_shap': mean_abs_shap_adm})
imp_adm = imp_adm.sort_values(by='mean_shap', ascending=False).head(15) # Highest at index 0 for React Top-Down render
imp_adm_list = imp_adm.to_dict(orient='records')
with open(os.path.join(json_out_dir, 'shap_adm_importance.json'), 'w') as f:
    json.dump(imp_adm_list, f)

# Patient Admission Waterfall Extract
print("Exporting Admission Waterfall Prototype...")
adm_risk = xgb_admission.predict_proba(X_adm_final)[:, 1]
high_risk_idx = np.argmax(adm_risk) 
shap_values_full_adm = explainer_adm.shap_values(X_adm_final.iloc[[high_risk_idx]])
expected_value_adm = explainer_adm.expected_value
if isinstance(expected_value_adm, np.ndarray): expected_value_adm = expected_value_adm[0]
if isinstance(expected_value_adm, list): expected_value_adm = expected_value_adm[0]

waterfall_adm = []
feat_vals_adm = X_adm_final.iloc[high_risk_idx].values
for i in range(len(X_adm_final.columns)):
    if abs(shap_values_full_adm[0][i]) > 0.05: # Filter noise
        waterfall_adm.append({
            'name': X_adm_final.columns[i],
            'feature_value': float(feat_vals_adm[i]),
            'shap': float(shap_values_full_adm[0][i])  # Raw SHAP value
        })
waterfall_adm = sorted(waterfall_adm, key=lambda x: abs(x['shap']), reverse=True) # Highest impact at Index 0

with open(os.path.join(json_out_dir, 'shap_adm_waterfall.json'), 'w') as f:
    json.dump({'base_value': float(expected_value_adm), 'prediction': float(adm_risk[high_risk_idx]), 'data': waterfall_adm}, f)


print("Calculating Readmission Explainers...")
explainer_readm = shap.TreeExplainer(xgb_readmission)
shap_values_readm = explainer_readm.shap_values(X_readm_sample)

# Global Readmission Feature Importance
print("Exporting Readmission Global SHAP...")
mean_abs_shap_readm = np.abs(shap_values_readm).mean(axis=0)
imp_readm = pd.DataFrame({'feature': X_readm_final.columns, 'mean_shap': mean_abs_shap_readm})
imp_readm = imp_readm.sort_values(by='mean_shap', ascending=False).head(15) 
imp_readm_list = imp_readm.to_dict(orient='records')
with open(os.path.join(json_out_dir, 'shap_readm_importance.json'), 'w') as f:
    json.dump(imp_readm_list, f)

# Patient Readmission Waterfall Extract
print("Exporting Readmission Waterfall Prototype...")
readm_risk = xgb_readmission.predict_proba(X_readm_final)[:, 1]
high_readm_risk_idx = np.nanargmax(readm_risk)
shap_values_full_readm = explainer_readm.shap_values(X_readm_final.iloc[[high_readm_risk_idx]])
expected_value_readm = explainer_readm.expected_value
if isinstance(expected_value_readm, np.ndarray): expected_value_readm = expected_value_readm[0]
if isinstance(expected_value_readm, list): expected_value_readm = expected_value_readm[0]

waterfall_readm = []
feat_vals_readm = X_readm_final.iloc[high_readm_risk_idx].values
for i in range(len(X_readm_final.columns)):
    if abs(shap_values_full_readm[0][i]) > 0.05: # Filter noise
        waterfall_readm.append({
            'name': X_readm_final.columns[i],
            'feature_value': float(feat_vals_readm[i]),
            'shap': float(shap_values_full_readm[0][i])
        })
waterfall_readm = sorted(waterfall_readm, key=lambda x: abs(x['shap']), reverse=True)

with open(os.path.join(json_out_dir, 'shap_readm_waterfall.json'), 'w') as f:
    json.dump({'base_value': float(expected_value_readm), 'prediction': float(readm_risk[high_readm_risk_idx]), 'data': waterfall_readm}, f)

print(f"✅ Extracted 4 Strict Interactive JSON Arrays successfully to {json_out_dir}")

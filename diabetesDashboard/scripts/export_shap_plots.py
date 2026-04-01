import os
import pandas as pd
import numpy as np
import joblib
import shap
import matplotlib
import matplotlib.pyplot as plt

# Structural Overrides mapping Matplotlib plots precisely to the React CSS (--text-muted) Slate-Grey (#889296)
plt.rcParams['text.color'] = '#889296'
plt.rcParams['axes.labelcolor'] = '#889296'
plt.rcParams['xtick.color'] = '#889296'
plt.rcParams['ytick.color'] = '#889296'
plt.rcParams['axes.edgecolor'] = '#889296'
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['font.sans-serif'] = ['Helvetica', 'Arial', 'sans-serif']

base_path = r'C:\Users\thiranbarath\Documents\GitHub\project-d'
model_dir = os.path.join(base_path, 'machineLearning', 'models')
img_out_dir = os.path.join(base_path, 'diabetesDashboard', 'public', 'assets')
os.makedirs(img_out_dir, exist_ok=True)

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

# Sample to 3000 for standard clear visual rendering in Beeswarm Plots globally
X_adm_sample = shap.sample(X_adm_final, 3000)
X_readm_sample = shap.sample(X_readm_final, 3000)

print("Calculating Admission Explainers...")
explainer_adm = shap.TreeExplainer(xgb_admission)
shap_values_adm = explainer_adm.shap_values(X_adm_sample)

print("Generating Admission SHAP Beeswarm Plot...")
plt.figure(figsize=(10, 6))
shap.summary_plot(shap_values_adm, X_adm_sample, show=False)
plt.tight_layout()
plt.savefig(os.path.join(img_out_dir, 'shap_adm_beeswarm.png'), transparent=True, dpi=150)
plt.close()

print("Generating Admission SHAP Waterfall Example...")
adm_risk = xgb_admission.predict_proba(X_adm_final)[:, 1]
high_risk_idx = np.argmax(adm_risk) 
shap_values_full_adm = explainer_adm.shap_values(X_adm_final.iloc[[high_risk_idx]])
expected_value_adm = explainer_adm.expected_value
if isinstance(expected_value_adm, np.ndarray): expected_value_adm = expected_value_adm[0]
if isinstance(expected_value_adm, list): expected_value_adm = expected_value_adm[0]

explanation_adm = shap.Explanation(
    values=shap_values_full_adm[0],
    base_values=expected_value_adm,
    data=X_adm_final.iloc[high_risk_idx].values,
    feature_names=X_adm_final.columns.tolist()
)

plt.figure(figsize=(10, 6))
shap.plots.waterfall(explanation_adm, show=False)
plt.tight_layout()
plt.savefig(os.path.join(img_out_dir, 'shap_adm_waterfall.png'), transparent=True, dpi=150)
plt.close()

print("Calculating Readmission Explainers...")
explainer_readm = shap.TreeExplainer(xgb_readmission)
shap_values_readm = explainer_readm.shap_values(X_readm_sample)

print("Generating Readmission SHAP Beeswarm Plot...")
plt.figure(figsize=(10, 6))
shap.summary_plot(shap_values_readm, X_readm_sample, show=False)
plt.tight_layout()
plt.savefig(os.path.join(img_out_dir, 'shap_readm_beeswarm.png'), transparent=True, dpi=150)
plt.close()

print("Generating Readmission SHAP Waterfall Example...")
readm_risk = xgb_readmission.predict_proba(X_readm_final)[:, 1]
high_readm_risk_idx = np.nanargmax(readm_risk)
shap_values_full_readm = explainer_readm.shap_values(X_readm_final.iloc[[high_readm_risk_idx]])
expected_value_readm = explainer_readm.expected_value
if isinstance(expected_value_readm, np.ndarray): expected_value_readm = expected_value_readm[0]
if isinstance(expected_value_readm, list): expected_value_readm = expected_value_readm[0]

explanation_readm = shap.Explanation(
    values=shap_values_full_readm[0],
    base_values=expected_value_readm,
    data=X_readm_final.iloc[high_readm_risk_idx].values,
    feature_names=X_readm_final.columns.tolist()
)

plt.figure(figsize=(10, 6))
shap.plots.waterfall(explanation_readm, show=False)
plt.tight_layout()
plt.savefig(os.path.join(img_out_dir, 'shap_readm_waterfall.png'), transparent=True, dpi=150)
plt.close()

print(f"✅ Extracted 4 styled Multi-Format PNG Models successfully to {img_out_dir}")

import json

def fix_04():
    nb_path = r"C:\Users\thiranbarath\Documents\GitHub\project-d\machineLearning\source code\04_Export_Dashboard_Payload.ipynb"
    with open(nb_path, "r", encoding="utf-8") as f:
        nb = json.load(f)
        
    for cell in nb.get('cells', []):
        if cell.get('cell_type') == 'code':
            source = "".join(cell.get('source', []))
            
            # Load thresholds
            if "scaler_readmission = joblib.load" in source and "thresh_adm =" not in source:
                new_src = source.replace(
                    "print('Models loaded successfully.')",
                    "thresh_adm = joblib.load(os.path.join(model_dir, 'xgboost_admission_threshold.pkl'))\n"
                    "thresh_readm = joblib.load(os.path.join(model_dir, 'xgboost_readmission_threshold.pkl'))\n"
                    "print('Models and Thresholds loaded successfully.')"
                )
                cell['source'] = new_src.splitlines(True)
                source = new_src

            # Fix hardcoded threshold logic
            if "adm_pred = (adm_risk >= 0.35).astype(int)" in source:
                new_src = source.replace(
                    "adm_pred = (adm_risk >= 0.35).astype(int)  # 0.35 is approx the optimal threshold from training",
                    "adm_pred = (adm_risk >= thresh_adm).astype(int)"
                )
                cell['source'] = new_src.splitlines(True)
                source = new_src
                
            # Fix Stage 2 feature leakage matching
            if "leakage_cols_readm = ['Admitted_Yes_No', 'Num_Admissions', 'Num_Visits', 'Readmitted_Yes_No']" in source:
                new_src = source.replace(
                    "leakage_cols_readm = ['Admitted_Yes_No', 'Num_Admissions', 'Num_Visits', 'Readmitted_Yes_No']",
                    "leakage_cols_readm = ['Admitted_Yes_No', 'Num_Admissions', 'Readmitted_Yes_No']"
                )
                new_src = new_src.replace(
                    "continuous_cols_readm = ['AGE', 'Avg_LOS', 'Total_Meds_Count', 'Total_Unique_Diagnoses', 'Severity_Encoded']",
                    "continuous_cols_readm = ['AGE', 'Avg_LOS', 'Num_Visits', 'Total_Meds_Count', 'Total_Unique_Diagnoses', 'Severity_Encoded']"
                )
                cell['source'] = new_src.splitlines(True)
                source = new_src
                
            # Add SHAP Stage 2 calculation
            if "shap_values_adm = explainer_adm.shap_values(X_adm_final)" in source and "shap_values_readm =" not in source:
                new_src = source.replace(
                    "shap_values_adm = explainer_adm.shap_values(X_adm_final)",
                    "shap_values_adm = explainer_adm.shap_values(X_adm_final)\n"
                    "explainer_readm = shap.TreeExplainer(xgb_readmission)\n"
                    "shap_values_readm = explainer_readm.shap_values(X_readm_final)"
                )
                cell['source'] = new_src.splitlines(True)
                source = new_src
                
            # Assembling JSON loop Fixes
            if "top_drivers = get_top_features(idx, shap_values_adm, feature_names)" in source:
                new_src = source.replace(
                    "    top_drivers = get_top_features(idx, shap_values_adm, feature_names)",
                    "    if adm_pred[idx] == 1:\n"
                    "        # If admitted, show drivers for readmission (Stage 2)\n"
                    "        top_drivers = get_top_features(idx, shap_values_readm, list(X_readm_final.columns))\n"
                    "    else:\n"
                    "        # If not admitted, show drivers for admission (Stage 1)\n"
                    "        top_drivers = get_top_features(idx, shap_values_adm, feature_names)"
                )
                cell['source'] = new_src.splitlines(True)
                source = new_src
                
    with open(nb_path, "w", encoding="utf-8") as f:
        json.dump(nb, f, indent=1)
        
    print("04_Export_Dashboard_Payload.ipynb updated successfully.")

if __name__ == "__main__":
    fix_04()

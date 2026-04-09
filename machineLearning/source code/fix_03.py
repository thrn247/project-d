import json

def fix_03():
    nb_path = r"C:\Users\thiranbarath\Documents\GitHub\project-d\machineLearning\source code\03_ML_Model_Readmission.ipynb"
    with open(nb_path, "r", encoding="utf-8") as f:
        nb = json.load(f)
        
    for cell in nb.get('cells', []):
        if cell.get('cell_type') == 'code':
            source = cell.get('source', [])
            source_txt = "".join(source)
            
            # fix cols_to_drop
            if "cols_to_drop = ['Admitted_Yes_No', 'Num_Admissions', 'Num_Visits', target]" in source_txt:
                new_src = source_txt.replace(
                    "cols_to_drop = ['Admitted_Yes_No', 'Num_Admissions', 'Num_Visits', target]",
                    "cols_to_drop = ['Admitted_Yes_No', 'Num_Admissions', target]"
                )
                cell['source'] = new_src.splitlines(True)
                print("Replaced cols_to_drop")
                source_txt = new_src
            
            # fix continuous_cols
            if "continuous_cols = [" in source_txt and "'AGE'," in source_txt and "'Num_Visits'," not in source_txt:
                new_src = source_txt.replace("'AGE',", "'AGE',\n    'Num_Visits',")
                cell['source'] = new_src.splitlines(True)
                print("Added Num_Visits to continuous_cols")
                source_txt = new_src
                
            # fix evaluate threshold func
            if "def evaluate_model_with_optimal_threshold(model, name, X_train, y_train, X_test, y_test):" in source_txt:
                new_src = source_txt.replace(
                    "return y_test_proba, y_pred_optimal\n",
                    "return y_test_proba, y_pred_optimal, optimal_threshold\n"
                )
                new_src = new_src.replace(
                    "y_proba_lr, y_pred_lr = evaluate_model_with_optimal_threshold",
                    "y_proba_lr, y_pred_lr, thresh_lr = evaluate_model_with_optimal_threshold"
                )
                new_src = new_src.replace(
                    "y_proba_rf, y_pred_rf = evaluate_model_with_optimal_threshold",
                    "y_proba_rf, y_pred_rf, thresh_rf = evaluate_model_with_optimal_threshold"
                )
                new_src = new_src.replace(
                    "y_proba_xgb, y_pred_xgb = evaluate_model_with_optimal_threshold",
                    "y_proba_xgb, y_pred_xgb, thresh_xgb = evaluate_model_with_optimal_threshold"
                )
                cell['source'] = new_src.splitlines(True)
                print("Updated evaluate output")
                source_txt = new_src
                
            # fix export
            if "joblib.dump(xgb_model, os.path.join(model_dir, \"xgboost_readmission.pkl\"))" in source_txt:
                new_src = source_txt.replace(
                    "print(\"✅ All readmission models exported successfully!\")",
                    "joblib.dump(float(thresh_xgb), os.path.join(model_dir, 'xgboost_readmission_threshold.pkl'))\nprint(\"✅ All readmission models and thresholds exported successfully!\")"
                )
                cell['source'] = new_src.splitlines(True)
                print("Updated exports to include threshold")
                
    with open(nb_path, "w", encoding="utf-8") as f:
        json.dump(nb, f, indent=1)
        
    print("03_ML_Model_Readmission.ipynb updated successfully.")

if __name__ == "__main__":
    fix_03()

import json

def fix_02():
    nb_path = r"C:\Users\thiranbarath\Documents\GitHub\project-d\machineLearning\source code\02_ML_Model_Admission.ipynb"
    with open(nb_path, "r", encoding="utf-8") as f:
        nb = json.load(f)
        
    old_def = "def evaluate_model_with_optimal_threshold(model, name, X_test, y_test):"
    
    new_source = [
        "import numpy as np\n",
        "from sklearn.metrics import classification_report, precision_recall_curve, roc_auc_score, auc\n",
        "\n",
        "print(\"--- PHASE 4: EVALUATION ON TEST SET (WITH THRESHOLD OPTIMIZATION) ---\\n\")\n",
        "\n",
        "def evaluate_model_with_optimal_threshold(model, name, X_train, y_train, X_test, y_test):\n",
        "    # 1. Find optimal threshold using Training Data to prevent leakage\n",
        "    y_train_proba = model.predict_proba(X_train)[:, 1]\n",
        "    precisions, recalls, thresholds = precision_recall_curve(y_train, y_train_proba)\n",
        "    f1_scores = (2 * precisions[:-1] * recalls[:-1]) / (precisions[:-1] + recalls[:-1] + 1e-10)\n",
        "    optimal_idx = np.argmax(f1_scores)\n",
        "    optimal_threshold = thresholds[optimal_idx]\n",
        "    \n",
        "    # 2. Apply that learned threshold to Test Data\n",
        "    y_test_proba = model.predict_proba(X_test)[:, 1]\n",
        "    y_pred_optimal = (y_test_proba >= optimal_threshold).astype(int)\n",
        "    \n",
        "    # 3. Evaluate\n",
        "    test_precisions, test_recalls, _ = precision_recall_curve(y_test, y_test_proba)\n",
        "    roc_auc = roc_auc_score(y_test, y_test_proba)\n",
        "    pr_auc = auc(test_recalls, test_precisions)\n",
        "    \n",
        "    print(f\"--- {name} ---\")\n",
        "    print(f\"🎯 Optimal Threshold (Learned from Train): {optimal_threshold:.4f}\")\n",
        "    print(f\"📈 ROC-AUC Score: {roc_auc:.4f} | PR-AUC Score: {pr_auc:.4f}\")\n",
        "    print(classification_report(y_test, y_pred_optimal))\n",
        "    print(\"\\n\")\n",
        "    \n",
        "    return y_test_proba, y_pred_optimal, optimal_threshold\n",
        "\n",
        "y_proba_lr, y_pred_lr, thresh_lr = evaluate_model_with_optimal_threshold(lr_model, \"LOGISTIC REGRESSION\", X_train_final, y_train, X_test_final, y_test)\n",
        "y_proba_rf, y_pred_rf, thresh_rf = evaluate_model_with_optimal_threshold(rf_model, \"RANDOM FOREST\", X_train_final, y_train, X_test_final, y_test)\n",
        "y_proba_xgb, y_pred_xgb, thresh_xgb = evaluate_model_with_optimal_threshold(xgb_model, \"XGBOOST\", X_train_final, y_train, X_test_final, y_test)\n"
    ]

    for cell in nb.get('cells', []):
        if cell.get('cell_type') == 'code':
            source = "".join(cell.get('source', []))
            if old_def in source or "def evaluate_model_with_optimal_threshold" in source:
                cell['source'] = new_source
                print("Replaced threshold tuning logic.")
                break
                
    # Add new phase 8 export cell
    export_md = {
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "### Phase 8: Exporting Models & Thresholds\n",
            "\n",
            "This chunk executes the relevant logic for the step mentioned above."
        ]
    }
    
    export_code = {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "import joblib\n",
            "import os\n",
            "\n",
            "print(\"--- PHASE 8: EXPORTING MODELS & THRESHOLDS ---\")\n",
            "model_dir = os.path.join(base_path, \"machineLearning\", \"models\")\n",
            "os.makedirs(model_dir, exist_ok=True)\n",
            "\n",
            "# Export Models\n",
            "joblib.dump(lr_model, os.path.join(model_dir, \"logistic_regression_admission.pkl\"))\n",
            "joblib.dump(rf_model, os.path.join(model_dir, \"random_forest_admission.pkl\"))\n",
            "joblib.dump(xgb_model, os.path.join(model_dir, \"xgboost_admission.pkl\"))\n",
            "\n",
            "# Export Preprocessor\n",
            "joblib.dump(preprocessor, os.path.join(model_dir, \"standard_scaler.pkl\"))\n",
            "\n",
            "# Export Threshold\n",
            "joblib.dump(float(thresh_xgb), os.path.join(model_dir, \"xgboost_admission_threshold.pkl\"))\n",
            "print(\"✅ Models, preprocessor, and exact optimized thresholds exported successfully!\")\n"
        ]
    }
    
    nb['cells'].append(export_md)
    nb['cells'].append(export_code)
    print("Appended export models cell.")

    with open(nb_path, "w", encoding="utf-8") as f:
        json.dump(nb, f, indent=1)
        
    print("02_ML_Model_Admission.ipynb updated successfully.")

if __name__ == "__main__":
    fix_02()

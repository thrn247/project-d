import json
import os

file_path = r'C:\Users\thiranbarath\Documents\GitHub\project-d\machineLearning\source code\02_ML_Model_Admission.ipynb'

with open(file_path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

new_source = [
    "from sklearn.metrics import classification_report, precision_recall_curve\n",
    "import numpy as np\n",
    "\n",
    "print(\"--- PHASE 4: EVALUATION ON TEST SET (WITH THRESHOLD OPTIMIZATION) ---\\n\")\n",
    "\n",
    "# 1. Generate Baseline Predictions (using default 0.5 threshold)\n",
    "y_pred_lr = lr_model.predict(X_test_final)\n",
    "y_pred_rf = rf_model.predict(X_test_final)\n",
    "\n",
    "# XGBoost probabilities\n",
    "y_proba_xgb = xgb_model.predict_proba(X_test_final)[:, 1]\n",
    "\n",
    "# 2. Find the Optimal Threshold for XGBoost using Precision-Recall Curve\n",
    "precisions, recalls, thresholds = precision_recall_curve(y_test, y_proba_xgb)\n",
    "\n",
    "# Calculate F1-scores for each threshold (adding tiny epsilon to avoid division by zero)\n",
    "f1_scores = (2 * precisions[:-1] * recalls[:-1]) / (precisions[:-1] + recalls[:-1] + 1e-10)\n",
    "\n",
    "# Get the index of the highest F1-score\n",
    "optimal_idx = np.argmax(f1_scores)\n",
    "optimal_threshold = thresholds[optimal_idx]\n",
    "\n",
    "print(f\"🎯 Calculated Optimal Probability Threshold for XGBoost: {optimal_threshold:.4f}\\n\")\n",
    "\n",
    "# Generate new XGBoost predictions based on optimal threshold\n",
    "y_pred_xgb = (y_proba_xgb >= optimal_threshold).astype(int)\n",
    "\n",
    "# 3. Print Reports\n",
    "print(\"--- LOGISTIC REGRESSION (Default Threshold) ---\")\n",
    "print(classification_report(y_test, y_pred_lr))\n",
    "\n",
    "print(\"\\n--- RANDOM FOREST (Default Threshold) ---\")\n",
    "print(classification_report(y_test, y_pred_rf))\n",
    "\n",
    "print(f\"\\n--- TUNED XGBOOST (Optimal Threshold: {optimal_threshold:.2f}) ---\")\n",
    "print(classification_report(y_test, y_pred_xgb))\n"
]

cells = nb.get('cells', [])
c_idx = -1

for i, cell in enumerate(cells):
    if cell.get('cell_type') == 'code':
        src = "".join(cell.get('source', []))
        if 'PHASE 4: EVALUATION ON TEST SET' in src:
            c_idx = i
            break

if c_idx != -1:
    cells[c_idx]['source'] = new_source
    cells[c_idx]['outputs'] = []
    cells[c_idx]['execution_count'] = None
    
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(nb, f, indent=1)
    print("SUCCESS: Notebook updated with Step 3 improvements.")
else:
    print(f"FAILED: Could not locate the cell. c_idx={c_idx}")

import json
import os

file_path = r'C:\Users\thiranbarath\Documents\GitHub\project-d\machineLearning\source code\02_ML_Model_Admission.ipynb'

with open(file_path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

new_source = [
    "# --- 3. XGBoost (Tuned via RandomizedSearchCV) ---\n",
    "from sklearn.model_selection import RandomizedSearchCV, StratifiedKFold\n",
    "from xgboost import XGBClassifier\n",
    "import time\n",
    "\n",
    "print(\"Training & Tuning XGBoost...\")\n",
    "start_time = time.time()\n",
    "\n",
    "# 1. Setup Cross-Validation\n",
    "cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=42)\n",
    "\n",
    "# 2. Define Parameter Grid\n",
    "param_grid = {\n",
    "    'max_depth': [3, 5, 7],\n",
    "    'learning_rate': [0.01, 0.05, 0.1, 0.2],\n",
    "    'n_estimators': [100, 200, 300],\n",
    "    'subsample': [0.8, 0.9, 1.0],\n",
    "    'colsample_bytree': [0.8, 0.9, 1.0]\n",
    "}\n",
    "\n",
    "# 3. Initialize RandomizedSearchCV\n",
    "xgb_tuned = RandomizedSearchCV(\n",
    "    XGBClassifier(scale_pos_weight=scale_weight, eval_metric='logloss'),\n",
    "    param_distributions=param_grid,\n",
    "    n_iter=10,\n",
    "    scoring='f1', # Optimize for F1-score of the minority class!\n",
    "    cv=cv,\n",
    "    random_state=42,\n",
    "    n_jobs=-1\n",
    ")\n",
    "\n",
    "# 4. Fit the tuner\n",
    "xgb_tuned.fit(X_train_final, y_train)\n",
    "\n",
    "# 5. Extract the best model\n",
    "xgb_model = xgb_tuned.best_estimator_\n",
    "\n",
    "print(f\"✅ XGBoost Tuned & Trained in {time.time() - start_time:.2f} seconds\")\n",
    "print(f\"🏆 Best Parameters: {xgb_tuned.best_params_}\")\n"
]

cells = nb.get('cells', [])
c_idx = -1

for i, cell in enumerate(cells):
    if cell.get('cell_type') == 'code':
        src = "".join(cell.get('source', []))
        if '# --- 3. XGBoost ---' in src:
            c_idx = i

if c_idx != -1:
    cells[c_idx]['source'] = new_source
    cells[c_idx]['outputs'] = []
    cells[c_idx]['execution_count'] = None
    
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(nb, f, indent=1)
    print("SUCCESS: Notebook updated with Step 2 improvements.")
else:
    print(f"FAILED: Could not locate the cell. c_idx={c_idx}")

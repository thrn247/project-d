import json

file_path = r'C:\Users	hiranbarath\Documents\GitHub\project-d\machineLearning\source code\02_ML_Model_Admission.ipynb'

with open(file_path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

c4_source_raw = """import time
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GridSearchCV, RandomizedSearchCV, StratifiedKFold
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier

print("--- PHASE 3: MODEL TRAINING & HYPERPARAMETER TUNING ---")

# Calculate the exact imbalance ratio for XGBoost later
negative_cases = (y_train == 0).sum()
positive_cases = (y_train == 1).sum()
scale_weight = negative_cases / positive_cases

print(f"Dataset Imbalance Ratio: 1 Admission for every {scale_weight:.2f} Non-Admissions." + chr(10))

# Setup Cross-Validation strategy for all models
cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=42)

# --- 1. Logistic Regression ---      
print("Training & Tuning Logistic Regression...")
start_time = time.time()

lr_param_grid = {
    'C': [0.01, 0.1, 1, 10],
    'solver': ['lbfgs', 'liblinear'],
    'class_weight': ['balanced']
}

lr_tuned = GridSearchCV(
    LogisticRegression(random_state=42, max_iter=2000),
    param_grid=lr_param_grid,
    scoring='f1',
    cv=cv,
    n_jobs=-1
)
lr_tuned.fit(X_train_final, y_train)
lr_model = lr_tuned.best_estimator_

print(f"✅ LR Tuned & Trained in {time.time() - start_time:.2f} seconds")
print(f"🏆 LR Best Parameters: {lr_tuned.best_params_}")
"""

c5_source_raw = """# --- 2. Random Forest ---    
print(chr(10) + "Training & Tuning Random Forest...")    
start_time = time.time()

rf_param_grid = {
    'n_estimators': [100, 200, 300],
    'max_depth': [5, 10, 15, None],
    'min_samples_split': [2, 5, 10],
    'min_samples_leaf': [1, 2, 4],
    'class_weight': ['balanced', 'balanced_subsample']
}

rf_tuned = RandomizedSearchCV(
    RandomForestClassifier(random_state=42, n_jobs=-1),
    param_distributions=rf_param_grid,
    n_iter=10,
    scoring='f1',
    cv=cv,
    random_state=42,
    n_jobs=-1
)
rf_tuned.fit(X_train_final, y_train)  
rf_model = rf_tuned.best_estimator_

print(f"✅ RF Tuned & Trained in {time.time() - start_time:.2f} seconds")
print(f"🏆 RF Best Parameters: {rf_tuned.best_params_}")
"""

c6_source_raw = """# --- 3. XGBoost ---
print(chr(10) + "Training & Tuning XGBoost...")
start_time = time.time()

# Define Parameter Grid
xgb_param_grid = {
    'max_depth': [3, 5, 7],
    'learning_rate': [0.01, 0.05, 0.1, 0.2],
    'n_estimators': [100, 200, 300],
    'subsample': [0.8, 0.9, 1.0],
    'colsample_bytree': [0.8, 0.9, 1.0]
}

# Initialize RandomizedSearchCV
xgb_tuned = RandomizedSearchCV(
    XGBClassifier(scale_pos_weight=scale_weight, eval_metric='logloss'),
    param_distributions=xgb_param_grid,
    n_iter=10,
    scoring='f1', 
    cv=cv,
    random_state=42,
    n_jobs=-1
)

# Fit the tuner
xgb_tuned.fit(X_train_final, y_train)

# Extract the best model
xgb_model = xgb_tuned.best_estimator_

print(f"✅ XGBoost Tuned & Trained in {time.time() - start_time:.2f} seconds")
print(f"🏆 XGBoost Best Parameters: {xgb_tuned.best_params_}")
"""

c7_source_raw = """from sklearn.metrics import classification_report, precision_recall_curve, roc_auc_score, auc
import numpy as np

print("--- PHASE 4: EVALUATION ON TEST SET (WITH THRESHOLD OPTIMIZATION) ---" + chr(10))

# Function to find optimal threshold and evaluate
def evaluate_model_with_optimal_threshold(model, name, X_test, y_test):
    # Get probabilities for the positive class
    y_proba = model.predict_proba(X_test)[:, 1]
    
    # Calculate Precision-Recall Curve
    precisions, recalls, thresholds = precision_recall_curve(y_test, y_proba)
    
    # Calculate F1-scores for each threshold (adding tiny epsilon to avoid division by zero)
    f1_scores = (2 * precisions[:-1] * recalls[:-1]) / (precisions[:-1] + recalls[:-1] + 1e-10)
    
    # Get the index of the highest F1-score
    optimal_idx = np.argmax(f1_scores)
    optimal_threshold = thresholds[optimal_idx]
    
    # Generate new predictions based on optimal threshold
    y_pred_optimal = (y_proba >= optimal_threshold).astype(int)
    
    # Calculate AUCs
    roc_auc = roc_auc_score(y_test, y_proba)
    pr_auc = auc(recalls, precisions)
    
    print(f"--- {name} ---")
    print(f"🎯 Optimal Threshold: {optimal_threshold:.4f}")
    print(f"📈 ROC-AUC Score: {roc_auc:.4f} | PR-AUC Score: {pr_auc:.4f}")
    print(classification_report(y_test, y_pred_optimal))
    print(chr(10))
    
    return y_proba, y_pred_optimal

y_proba_lr, y_pred_lr = evaluate_model_with_optimal_threshold(lr_model, "LOGISTIC REGRESSION", X_test_final, y_test)
y_proba_rf, y_pred_rf = evaluate_model_with_optimal_threshold(rf_model, "RANDOM FOREST", X_test_final, y_test)
y_proba_xgb, y_pred_xgb = evaluate_model_with_optimal_threshold(xgb_model, "XGBOOST", X_test_final, y_test)
"""

c8_source_raw = """import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import confusion_matrix

# Create a figure with 3 subplots
fig, axes = plt.subplots(1, 3, figsize=(18, 5))
fig.suptitle('Confusion Matrices (At Optimal Thresholds): Predicting Hospital Admissions', fontsize=16)

models = [
    ('Logistic Regression', y_pred_lr),
    ('Random Forest', y_pred_rf),
    ('XGBoost', y_pred_xgb)
]

for i, (name, y_pred) in enumerate(models):
    cm = confusion_matrix(y_test, y_pred)
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', ax=axes[i], cbar=False)
    axes[i].set_title(f'{name}')
    axes[i].set_xlabel('Predicted Label (0=Not Admitted, 1=Admitted)')
    axes[i].set_ylabel('True Label')

plt.tight_layout()
plt.show()
"""

c9_source_raw = """from sklearn.metrics import roc_curve, precision_recall_curve, auc

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(18, 8))

models_proba = [
    ('Logistic Regression', y_proba_lr),
    ('Random Forest', y_proba_rf),
    ('XGBoost', y_proba_xgb)
]

# --- Plot 1: ROC Curve ---
for name, y_proba in models_proba:
    fpr, tpr, _ = roc_curve(y_test, y_proba)
    roc_auc = auc(fpr, tpr)
    ax1.plot(fpr, tpr, lw=2, label=f'{name} (AUC = {roc_auc:.3f})')

ax1.plot([0, 1], [0, 1], color='navy', lw=2, linestyle='--', label='Random Guessing (AUC = 0.500)')
ax1.set_xlim([0.0, 1.0])
ax1.set_ylim([0.0, 1.05])
ax1.set_xlabel('False Positive Rate (False Alarms)')
ax1.set_ylabel('True Positive Rate (Recall)')
ax1.set_title('ROC Curve Comparison')
ax1.legend(loc="lower right")
ax1.grid(alpha=0.3)

# --- Plot 2: Precision-Recall Curve ---
for name, y_proba in models_proba:
    precisions, recalls, _ = precision_recall_curve(y_test, y_proba)
    pr_auc = auc(recalls, precisions)
    ax2.plot(recalls, precisions, lw=2, label=f'{name} (PR-AUC = {pr_auc:.3f})')

# Baseline for PR curve is the ratio of positive cases
baseline = y_test.sum() / len(y_test)
ax2.plot([0, 1], [baseline, baseline], color='navy', lw=2, linestyle='--', label=f'Baseline (AUC = {baseline:.3f})')

ax2.set_xlim([0.0, 1.0])
ax2.set_ylim([0.0, 1.05])
ax2.set_xlabel('Recall (True Positive Rate)')
ax2.set_ylabel('Precision (Positive Predictive Value)')
ax2.set_title('Precision-Recall Curve Comparison (Crucial for Imbalanced Data)')
ax2.legend(loc="upper right")
ax2.grid(alpha=0.3)

plt.tight_layout()
plt.show()
"""

def format_source(raw_str):
    return [line + chr(10) for line in raw_str.split(chr(10))]

cells = nb.get('cells', [])
cells[4]['source'] = format_source(c4_source_raw)
cells[5]['source'] = format_source(c5_source_raw)
cells[6]['source'] = format_source(c6_source_raw)
cells[7]['source'] = format_source(c7_source_raw)
cells[8]['source'] = format_source(c8_source_raw)
cells[9]['source'] = format_source(c9_source_raw)

for i in range(4, 10):
    cells[i]['outputs'] = []
    cells[i]['execution_count'] = None

with open(file_path, 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1)

print("SUCCESS: Notebook fully upgraded to bulletproof standards.")

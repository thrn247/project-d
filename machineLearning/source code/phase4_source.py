import os
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import classification_report, confusion_matrix, roc_curve, auc

print("--- PHASE 4.5: SAVING METRICS TO DISK ---\n")

# 1. Define and create the plots directory
plots_dir = os.path.join(base_path, "machineLearning", "plots")
os.makedirs(plots_dir, exist_ok=True)
print(f"Directory ready: {plots_dir}")

# ==========================================
# 2. SAVE CLASSIFICATION REPORTS (TEXT FILE)
# ==========================================
report_path = os.path.join(plots_dir, "01_Admission_Classification_Reports.txt")
with open(report_path, "w") as f:
    f.write("--- LOGISTIC REGRESSION ---\n")
    f.write(classification_report(y_test, y_pred_lr))
    f.write("\n\n--- RANDOM FOREST ---\n")
    f.write(classification_report(y_test, y_pred_rf))
    f.write("\n\n--- XGBOOST ---\n")
    f.write(classification_report(y_test, y_pred_xgb))
print(f"✅ Saved text reports to: 01_Admission_Classification_Reports.txt")

# ==========================================
# 3. SAVE CONFUSION MATRICES (IMAGE)
# ==========================================
fig, axes = plt.subplots(1, 3, figsize=(18, 5))
fig.suptitle('Confusion Matrices: Predicting PMCare Hospital Admissions', fontsize=16)

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
cm_path = os.path.join(plots_dir, "02_Admission_Confusion_Matrices.png")
plt.savefig(cm_path, dpi=300, bbox_inches='tight') # dpi=300 ensures print-quality resolution
plt.close() # Closes the plot so it doesn't double-print in the notebook
print(f"✅ Saved confusion matrices to: 02_Admission_Confusion_Matrices.png")

# ==========================================
# 4. SAVE ROC-AUC CURVE (IMAGE)
# ==========================================
plt.figure(figsize=(10, 8))

models_proba = [
    ('Logistic Regression', lr_model.predict_proba(X_test_final)[:, 1]),
    ('Random Forest', rf_model.predict_proba(X_test_final)[:, 1]),
    ('XGBoost', xgb_model.predict_proba(X_test_final)[:, 1])
]

for name, y_proba in models_proba:
    fpr, tpr, _ = roc_curve(y_test, y_proba)
    roc_auc = auc(fpr, tpr)
    plt.plot(fpr, tpr, lw=2, label=f'{name} (AUC = {roc_auc:.3f})')

plt.plot([0, 1], [0, 1], color='navy', lw=2, linestyle='--', label='Random Guessing (AUC = 0.500)')
plt.xlim([0.0, 1.0])
plt.ylim([0.0, 1.05])
plt.xlabel('False Positive Rate (False Alarms)')
plt.ylabel('True Positive Rate (Recall)')
plt.title('ROC Curve Comparison: Diabetic Admission Risk')
plt.legend(loc="lower right")
plt.grid(alpha=0.3)

roc_path = os.path.join(plots_dir, "03_Admission_ROC_Curve.png")
plt.savefig(roc_path, dpi=300, bbox_inches='tight')
plt.close()
print(f"✅ Saved ROC curve to: 03_Admission_ROC_Curve.png")

print("\n🎉 All evaluation assets successfully saved to disk!")
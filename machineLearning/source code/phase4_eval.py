import numpy as np
from sklearn.metrics import classification_report, precision_recall_curve, roc_auc_score, auc

print("--- PHASE 4: EVALUATION ON TEST SET (WITH THRESHOLD OPTIMIZATION) ---\n")

def evaluate_model_with_optimal_threshold(model, name, X_train, y_train, X_test, y_test):
    # 1. Find optimal threshold using Training Data to prevent leakage
    y_train_proba = model.predict_proba(X_train)[:, 1]
    precisions, recalls, thresholds = precision_recall_curve(y_train, y_train_proba)
    f1_scores = (2 * precisions[:-1] * recalls[:-1]) / (precisions[:-1] + recalls[:-1] + 1e-10)
    optimal_idx = np.argmax(f1_scores)
    optimal_threshold = thresholds[optimal_idx]
    
    # 2. Apply that learned threshold to Test Data
    y_test_proba = model.predict_proba(X_test)[:, 1]
    y_pred_optimal = (y_test_proba >= optimal_threshold).astype(int)
    
    # 3. Evaluate
    test_precisions, test_recalls, _ = precision_recall_curve(y_test, y_test_proba)
    roc_auc = roc_auc_score(y_test, y_test_proba)
    pr_auc = auc(test_recalls, test_precisions)
    
    print(f"--- {name} ---")
    print(f"🎯 Optimal Threshold (Learned from Train): {optimal_threshold:.4f}")
    print(f"📈 ROC-AUC Score: {roc_auc:.4f} | PR-AUC Score: {pr_auc:.4f}")
    print(classification_report(y_test, y_pred_optimal))
    print("\n")
    
    return y_test_proba, y_pred_optimal, optimal_threshold

y_proba_lr, y_pred_lr, thresh_lr = evaluate_model_with_optimal_threshold(lr_model, "LOGISTIC REGRESSION", X_train_final, y_train, X_test_final, y_test)
y_proba_rf, y_pred_rf, thresh_rf = evaluate_model_with_optimal_threshold(rf_model, "RANDOM FOREST", X_train_final, y_train, X_test_final, y_test)
y_proba_xgb, y_pred_xgb, thresh_xgb = evaluate_model_with_optimal_threshold(xgb_model, "XGBOOST", X_train_final, y_train, X_test_final, y_test)

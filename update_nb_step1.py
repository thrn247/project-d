import json
import os

file_path = r'C:\Users\thiranbarath\Documents\GitHub\project-d\machineLearning\source code\02_ML_Model_Admission.ipynb'

with open(file_path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

new_source_str = """from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler

print("--- STEP 1: SMART PREPROCESSING & SCALING ---")

# 1. Identify Continuous vs. Binary/Categorical columns
continuous_cols = [
    'AGE', 
    'Num_Visits', 
    'Total_Meds_Count', 
    'Total_Unique_Diagnoses', 
    'Severity_Encoded'
]

binary_cols = [col for col in X_train.columns if col not in continuous_cols]

print(f"Identified {len(continuous_cols)} continuous features to scale.")
print(f"Identified {len(binary_cols)} binary features to leave unscaled.\\n")

# 2. Build the ColumnTransformer
preprocessor = ColumnTransformer(
    transformers=[
        ('num', StandardScaler(), continuous_cols),
        ('cat', 'passthrough', binary_cols)
    ])

# 3. Fit and Transform the data
X_train_processed_array = preprocessor.fit_transform(X_train)
X_test_processed_array = preprocessor.transform(X_test)

# 4. Reconstruct Pandas DataFrames
new_column_order = continuous_cols + binary_cols

X_train_final = pd.DataFrame(X_train_processed_array, columns=new_column_order, index=X_train.index)
X_test_final = pd.DataFrame(X_test_processed_array, columns=new_column_order, index=X_test.index)

print(f"✅ Final Training features shape: {X_train_final.shape}")
print(f"✅ Final Testing features shape: {X_test_final.shape}")
print("\\nReady for Model Training!")
"""

# Format source for notebook (list of lines ending with \n)
new_source = [line + '\n' for line in new_source_str.split('\n')]
# Remove the last extra newline added by the split if needed
if new_source and new_source[-1] == '\n':
    new_source = new_source[:-1]

cells = nb.get('cells', [])
c4_idx = -1
c5_idx = -1

for i, cell in enumerate(cells):
    if cell.get('cell_type') == 'code':
        src = "".join(cell.get('source', []))
        if 'PHASE 1: CORRELATION CHECK' in src:
            c4_idx = i
        elif 'PHASE 2.5: FEATURE SELECTION & SCALING' in src:
            c5_idx = i

if c4_idx != -1 and c5_idx != -1:
    cells[c4_idx]['source'] = new_source
    cells[c4_idx]['outputs'] = []
    cells[c4_idx]['execution_count'] = None
    del cells[c5_idx]
    
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(nb, f, indent=1)
    print("SUCCESS: Notebook updated with Step 1 improvements.")
else:
    print(f"FAILED: Could not locate the cells. c4={c4_idx}, c5={c5_idx}")

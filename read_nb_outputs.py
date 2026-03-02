import json
import sys

file_path = r'C:\Users	hiranbarath\Documents\GitHub\project-d\machineLearning\source code\02_ML_Model_Admission.ipynb'

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        nb = json.load(f)
    
    for i, cell in enumerate(nb.get('cells', [])):
        if cell.get('cell_type') == 'code':
            outputs = cell.get('outputs', [])
            if outputs:
                print(f"
--- Cell {i} Outputs ---")
                for out in outputs:
                    if 'text' in out:
                        print("".join(out['text']))
except Exception as e:
    print(f"Error: {e}")

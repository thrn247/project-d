import json

file_path = r'C:\Users	hiranbarath\Documents\GitHub\project-d\machineLearning\source code\02_ML_Model_Admission.ipynb'

with open(file_path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

for i, cell in enumerate(nb.get('cells', [])):
    if cell.get('cell_type') == 'code':
        outputs = cell.get('outputs', [])
        if outputs:
            print("--- Cell " + str(i) + " Outputs ---")
            for out in outputs:
                if 'text' in out:
                    print("".join(out['text']))

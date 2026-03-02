import json

file_path = 'C:/Users/thiranbarath/Documents/GitHub/project-d/machineLearning/source code/02_ML_Model_Admission.ipynb'

with open(file_path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

for cell in nb.get('cells', []):
    if cell.get('cell_type') == 'code':
        src = cell.get('source', [])
        new_src = []
        changed = False
        for line in src:
            if "palette='viridis'" in line and "hue=" not in line:
                line = line.replace("palette='viridis'", "hue='Feature', palette='viridis', legend=False")
                changed = True
            new_src.append(line)
        if changed:
            cell['source'] = new_src
            cell['outputs'] = []

with open(file_path, 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1)

print("SUCCESS: Notebook feature importance cell updated.")
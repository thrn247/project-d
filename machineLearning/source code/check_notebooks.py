import os
import json
import glob

def check_notebook(filepath):
    print(f"--- Checking {os.path.basename(filepath)} ---")
    with open(filepath, 'r', encoding='utf-8') as f:
        nb_data = json.load(f)
    
    for i, cell in enumerate(nb_data.get('cells', [])):
        cell_type = cell['cell_type']
        source_preview = "".join(cell.get('source', []))[:100].replace('\n', '\\n')
        print(f"Cell {i} ({cell_type}): {source_preview}...")

def main():
    base_dir = r"c:\Users\thiranbarath\Documents\GitHub\project-d\machineLearning\source code"
    nb_files = glob.glob(os.path.join(base_dir, "*.ipynb"))
    for nb in nb_files:
        check_notebook(nb)

if __name__ == "__main__":
    main()

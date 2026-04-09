import os
import json
import glob

def extract_code(notebook_path, output_path):
    with open(notebook_path, 'r', encoding='utf-8') as f:
        nb = json.load(f)
    code = []
    for cell in nb.get('cells', []):
        if cell.get('cell_type') == 'code':
            code.append("".join(cell.get('source', [])))
            code.append("\n\n# " + "-"*40 + "\n\n")
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(code))
    print(f"Extracted {os.path.basename(notebook_path)} to {output_path}")

def main():
    src_dir = r"c:\Users\thiranbarath\Documents\GitHub\project-d\machineLearning\source code"
    scratch_dir = r"C:\Users\thiranbarath\.gemini\antigravity\brain\8b230615-da15-495a-bb48-9050221928bf\scratch"
    os.makedirs(scratch_dir, exist_ok=True)
    
    nonglob_files = [
        "01_ML_Data_Prep.ipynb",
        "02_ML_Model_Admission.ipynb",
        "03_ML_Model_Readmission.ipynb",
        "04_Export_Dashboard_Payload.ipynb"
    ]
    for filename in nonglob_files:
        nb_path = os.path.join(src_dir, filename)
        out_path = os.path.join(scratch_dir, filename.replace('.ipynb', '.py'))
        extract_code(nb_path, out_path)

if __name__ == "__main__":
    main()

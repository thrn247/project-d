import os
import json
import re
import glob

def clean_comment(text):
    # Remove emojis using a simple pattern (covers many common emojis)
    text = re.sub(r'[✅❌📂🔄⚠️🕵️💊🩺🔗🧹🔐✨ℹ️]', '', text)
    
    # Remove AI conversational tracking/gemini remarks
    text = text.replace(" (Updated: Removed 'OTHER_DIAGNOSIS')", "")
    text = text.replace(" (Keeping OTHER_DIAGNOSIS now)", "")
    text = text.replace(" (Includes OTHER_DIAGNOSIS)", "")
    text = text.replace("--- STRICT CLEANING ---", "Data Cleaning")
    text = text.replace("--- NEW LOGIC: COMBINE GLP-1 COLUMNS ---", "Combine GLP-1 Columns")
    
    return text

def determine_title_for_cell(cell_index, source_lines, nb_name):
    # Heuristic to create a summary for the cell
    # Default fallback:
    title = f"### Chunk {cell_index + 1}"
    
    for line in source_lines:
        line_clean = line.strip()
        
        # Look for explicit headers like "# 1. SETUP PATHS"
        if re.match(r'^#\s*\d+\.\s+[A-Z\s]+', line_clean):
            # Just use this header but formatting as markdown
            return f"### {line_clean[1:].strip()}"
        
        # Look for print statements marking steps
        if bool(re.search(r'print\("--- STEP', line_clean)) or bool(re.search(r"print\('--- STEP", line_clean)):
            matched = re.search(r'STEP \d+:([^"-]+)', line_clean)
            if matched:
                return f"### Chunk {cell_index + 1}: {matched.group(1).strip()}"
                
        # Look for print with emoji/action
        if line_clean.startswith('print("') and '...' in line_clean:
            action = line_clean.split('print("')[1].split('...')[0]
            action = clean_comment(action).strip()
            if action:
                return f"### Chunk {cell_index + 1}: {action}"
                
    return f"### Chunk {cell_index + 1}: Execution Block"

def process_notebook(filepath):
    print(f"Processing notebook: {filepath}")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        nb_data = json.load(f)
        
    new_cells = []
    
    # Specific targeted path fixes for `05_eda.ipynb`
    is_eda = "05_eda.ipynb" in filepath
    
    code_chunk_idx = 0
    for cell in nb_data.get('cells', []):
        if cell['cell_type'] == 'code':
            
            # 1. Generate Markdown description
            title = determine_title_for_cell(code_chunk_idx, cell.get('source', []), os.path.basename(filepath))
            
            # Construct a markdown cell
            md_cell = {
                "cell_type": "markdown",
                "metadata": {},
                "source": [
                    title + "\n",
                    "This chunk executes the relevant logic for the step mentioned above."
                ]
            }
            new_cells.append(md_cell)
            
            # 2. Clean the code cell source
            new_source = []
            for line in cell.get('source', []):
                cleaned_line = clean_comment(line)
                
                # Fix hardcoded paths in eda
                if is_eda and r'target_dir = r"C:\Users\thiranbarath\Documents\GitHub\dataPreprocessing\eda_plots"' in cleaned_line:
                    cleaned_line = 'target_dir = os.path.join(os.path.dirname(os.getcwd()), "eda_plots")\n'
                if is_eda and r'input_path = r"C:\Users\thiranbarath\Documents\GitHub\dataPreprocessing\csv\step4_patient_aggregated.xlsx"' in cleaned_line:
                    cleaned_line = 'input_path = os.path.join(os.path.dirname(os.getcwd()), "csv", "step4_patient_aggregated.xlsx")\n'
                
                new_source.append(cleaned_line)
                
            cell['source'] = new_source
            
            new_cells.append(cell)
            code_chunk_idx += 1
            
        elif cell['cell_type'] == 'markdown':
            # keep existing markdown cells
            new_cells.append(cell)
            
    nb_data['cells'] = new_cells
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(nb_data, f, indent=1)
        
    print(f"Updated {filepath}")

def main():
    base_dir = os.path.dirname(__file__)
    nb_files = glob.glob(os.path.join(base_dir, "*.ipynb"))
    for nb in nb_files:
        process_notebook(nb)

if __name__ == "__main__":
    main()

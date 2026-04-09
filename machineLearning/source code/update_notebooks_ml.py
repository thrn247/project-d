import os
import json
import re
import glob

def clean_comment(text):
    # Remove emojis and common characters used for borders in prints
    text = re.sub(r'[✅❌📂🔄⚠️🕵️💊🩺🔗🧹🔐✨ℹ️\-#=]+', '', text)
    # Remove step numbers if like "STEP 1:" or "1. " 
    text = re.sub(r'^(?:STEP \d+:?|\d+\.)\s*', '', text, flags=re.IGNORECASE)
    # also strip Phase X:
    text = re.sub(r'^PHASE \d+:?\s*', '', text, flags=re.IGNORECASE)
    return text.strip()

def extract_title_from_code(source_lines):
    for line in source_lines:
        line_clean = line.strip()

        # Skip imports and empty lines
        if not line_clean or line_clean.startswith('import ') or line_clean.startswith('from '):
            continue
            
        # check for comments
        if line_clean.startswith('#'):
            comment = clean_comment(line_clean)
            # Make sure it isn't just a very short comment or just purely symbol
            if comment and len(comment) >= 3:
                return f"### {comment.title()}"
                
        # check for prints with single or double quotes
        if 'print(' in line_clean:
            match = re.search(r'print\([\'"]([^\'"]+)[\'"]', line_clean)
            if match:
                print_text = clean_comment(match.group(1))
                if print_text and len(print_text) >= 3:
                    return f"### {print_text.title()}"
                    
    return "### Execution Chunk"

def process_notebook(filepath):
    print(f"Processing notebook: {filepath}")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        nb_data = json.load(f)
        
    new_cells = []
    
    for i, cell in enumerate(nb_data.get('cells', [])):
        if cell['cell_type'] == 'code':
            # Check if previous cell was markdown
            prev_is_markdown = False
            if len(new_cells) > 0 and new_cells[-1]['cell_type'] == 'markdown':
                prev_is_markdown = True
            
            if not prev_is_markdown:
                title = extract_title_from_code(cell.get('source', []))
                
                md_cell = {
                    "cell_type": "markdown",
                    "metadata": {},
                    "source": [
                        title + "\n\n",
                        "This chunk executes the relevant logic for the step mentioned above."
                    ]
                }
                new_cells.append(md_cell)
            
            # append the code cell
            new_cells.append(cell)
            
        elif cell['cell_type'] == 'markdown':
            new_cells.append(cell)
            
    nb_data['cells'] = new_cells
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(nb_data, f, indent=1)
        
    print(f"Updated {filepath}")

def main():
    base_dir = r"c:\Users\thiranbarath\Documents\GitHub\project-d\machineLearning\source code"
    nb_files = glob.glob(os.path.join(base_dir, "*.ipynb"))
    for nb in nb_files:
        process_notebook(nb)

if __name__ == "__main__":
    main()

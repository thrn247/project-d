import pandas as pd
import os
import glob

# 1. SETUP PATHS
# Set target folder to the parquet directory
target_folder = os.path.join(os.path.dirname(__file__), '..', 'parquet')

print("--- STARTING PARQUET TO EXCEL CONVERSION ---")
print(f"Target Folder: {target_folder}")

# 2. FIND FILES
# Locate all .parquet files in the target directory
files = glob.glob(os.path.join(target_folder, "*.parquet"))

print(f"Found {len(files)} parquet files to convert.\n")

# 3. CONVERT LOOP
for file_path in files:
    try:
        file_name = os.path.basename(file_path)
        print(f"Processing: {file_name} ...")
        
        # Read the Parquet file
        df = pd.read_parquet(file_path)
        
        # Limit rows to 1,000,000 for Excel compatibility
        if len(df) > 1000000:
            print(f"   File length ({len(df)} rows) exceeds Excel limit. Truncating to 1,000,000 rows.")
            df = df.head(1000000)
            
        # Create Output Filename (.xlsx)
        output_path = file_path.replace(".parquet", ".xlsx")
        
        # Save to Excel
        df.to_excel(output_path, index=False)
        print(f"   Created: {os.path.basename(output_path)}")
        
    except Exception as e:
        print(f"   Error formatting {file_name}: {e}")

print("\nConversion Complete.")
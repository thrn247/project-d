import pandas as pd
import os
import glob

# 1. SETUP PATHS
# specific folder path from your screenshot
target_folder = r"C:\Users\thiranbarath\Downloads"

print(f"--- STARTING FRESH: PARQUET TO EXCEL ---")
print(f"📂 Target Folder: {target_folder}")

# 2. FIND FILES
# We look for all .parquet files in that folder
files = glob.glob(os.path.join(target_folder, "*.parquet"))

print(f"Found {len(files)} parquet files to convert.\n")

# 3. CONVERT LOOP
for file_path in files:
    try:
        file_name = os.path.basename(file_path)
        print(f"🔄 Processing: {file_name} ...")
        
        # Read the Parquet file
        df = pd.read_parquet(file_path)
        
        # SAFETY CHECK: Excel has a 1 million row limit.
        if len(df) > 1000000:
            print(f"   ⚠️ File is huge ({len(df)} rows). Truncating to top 1,000,000 for Excel.")
            df = df.head(1000000)
            
        # Create Output Filename (.xlsx)
        output_path = file_path.replace(".parquet", ".xlsx")
        
        # Save
        df.to_excel(output_path, index=False)
        print(f"   ✅ Created: {os.path.basename(output_path)}")
        
    except Exception as e:
        print(f"   ❌ Error on {file_name}: {e}")

print("\n🎉 Conversion Complete. You can now open these in Excel.")
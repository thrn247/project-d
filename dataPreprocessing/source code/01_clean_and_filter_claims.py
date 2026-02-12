import polars as pl
import os

# 1. SETUP PATHS
path_parquet = r"C:\Users\thiranbarath\Documents\GitHub\dataPreprocessing\parquet\e11_claims.parquet"
output_path = r"C:\Users\thiranbarath\Documents\GitHub\dataPreprocessing\csv\step1_claims_filtered.xlsx"

# The Blacklist
provider_blacklist = ["SUPP343", "PHAR455", "PHAR588", "KPJ036"]

# --- THE DROP LIST (Updated: Removed 'OTHER_DIAGNOSIS') ---
cols_to_drop = [
    "DIAGNOSIS_LMGROUP", "RELATION", "CLAIM_AMOUNT", 
    "APPROVE_AMOUNT", "CLAIMANT_TYPE_CODE", "TREATMENT_DETAIL_CODE",
    "GL_CODE", "BATCH_CODE", "CLAIM_STATUS_CODE", 
    "SERVICE_TYPE_CODE", "COMPANY_CODE", 
    "PROVIDER_CODE", 
    "DIAGNOSIS_DESCRIPTION", "SERVICE_DATE", "DISCHARGE_DATE"
]

print("--- STEP 1: CLEANING (WITH OTHER_DIAGNOSIS KEPT) ---")

try:
    if not os.path.exists(path_parquet):
        raise FileNotFoundError(f"Missing file: {path_parquet}")
        
    # 2. LOAD
    print(f"Loading: {path_parquet}...")
    df = pl.read_parquet(path_parquet)
    print(f"Original Rows: {len(df)}")

    # 3. FILTER
    if "PROVIDER_CODE" in df.columns:
        df_clean = df.filter(~pl.col("PROVIDER_CODE").is_in(provider_blacklist))
        print(f"✅ Removed {len(df) - len(df_clean)} pharmacy records.")
    else:
        df_clean = df

    # 4. DROP (Keeping OTHER_DIAGNOSIS now)
    existing_drops = [c for c in cols_to_drop if c in df_clean.columns]
    df_clean = df_clean.drop(existing_drops)

    # 5. SAVE
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    pdf = df_clean.to_pandas()
    if len(pdf) > 1000000: pdf = pdf.head(1000000)
    pdf.to_excel(output_path, index=False)
    print(f"✅ SAVED: {output_path} (Includes OTHER_DIAGNOSIS)")

except Exception as e:
    print(f"❌ Error: {e}")
import polars as pl
import os

# 1. SETUP PATHS
base_dir = os.path.join(os.path.dirname(__file__), "..")
path_parquet = os.path.join(base_dir, "parquet", "e11_claims.parquet")
output_path = os.path.join(base_dir, "csv", "step1_claims_filtered.xlsx")

# Provider Blacklist
provider_blacklist = ["SUPP343", "PHAR455", "PHAR588", "KPJ036"]

# Columns to drop (maintaining OTHER_DIAGNOSIS and SERVICE_DATE).
# SERVICE_DATE is kept so step 4 can identify each patient's chronologically
# first inpatient claim — required for the causally-clean Index_LOS feature
# (replaces the old leaky Avg_LOS = mean across ALL claims).
cols_to_drop = [
    "DIAGNOSIS_LMGROUP", "RELATION", "CLAIM_AMOUNT",
    "APPROVE_AMOUNT", "CLAIMANT_TYPE_CODE", "TREATMENT_DETAIL_CODE",
    "GL_CODE", "BATCH_CODE", "CLAIM_STATUS_CODE",
    "SERVICE_TYPE_CODE", "COMPANY_CODE",
    "PROVIDER_CODE",
    "DIAGNOSIS_DESCRIPTION", "DISCHARGE_DATE"
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
        print(f"Removed {len(df) - len(df_clean)} pharmacy records.")
    else:
        df_clean = df

    # 3b. FILTER implausible AGE (T2DM cohort: adults only; source parquet has
    # missing-encoded-as-0 records and a few negative ages that propagate into
    # the model otherwise). Drops claim-level rows where AGE < 18.
    if "AGE" in df_clean.columns:
        before_age = len(df_clean)
        df_clean = df_clean.filter(pl.col("AGE") >= 18)
        print(f"Removed {before_age - len(df_clean)} claim-level rows with AGE < 18.")

    # 4. DROP (Keeping OTHER_DIAGNOSIS)
    existing_drops = [c for c in cols_to_drop if c in df_clean.columns]
    df_clean = df_clean.drop(existing_drops)

    # 5. SAVE
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    pdf = df_clean.to_pandas()
    if len(pdf) > 1000000: pdf = pdf.head(1000000)
    pdf.to_excel(output_path, index=False)
    print(f"Saved: {output_path} (Includes OTHER_DIAGNOSIS)")

except Exception as e:
    print(f"Error: {e}")
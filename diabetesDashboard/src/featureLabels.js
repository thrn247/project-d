// Single source of truth for technical feature names → clinical-language labels.
// Used by SHAP charts (cohort-wide importance, single-patient breakdown, slideout
// drivers) so clinicians read 'Diabetic retinopathy' instead of 'COMP_RETINOPATHY'.

export const FEATURE_LABELS = {
  AGE: 'Age (years)',
  Avg_LOS: 'Avg. length of inpatient stay (days)',
  Total_Meds_Count: 'Number of medication classes',
  Total_Unique_Diagnoses: 'Number of distinct diagnoses',
  Severity_Encoded: 'Clinical severity score',
  Num_Visits: 'Total clinical visits',
  SEX_M: 'Sex: Male',
  MED_ALPHA_GLUCOSIDE_INHIBITORS: 'Alpha-glucosidase inhibitors',
  MED_BIGUANIDE: 'Biguanides (e.g., metformin)',
  MED_COMBINATION_DRUG: 'Combination diabetes drug',
  MED_DPP_4_INHIBITORS: 'DPP-4 inhibitors',
  MED_GLP_1_RECEPTOR_AGONISTS: 'GLP-1 receptor agonists',
  MED_INSULIN_THERAPY: 'On insulin therapy',
  MED_MEGLITINIDES: 'Meglitinides',
  MED_SGLT_2_INHIBITORS: 'SGLT-2 inhibitors',
  MED_SULPHONYLUREAS: 'Sulphonylureas',
  MED_THIAZOLIDINEDIONES: 'Thiazolidinediones',
  COMP_DIABETIC_FOOT: 'Diabetic foot complication',
  COMP_MACROVASCULAR: 'Macrovascular complication',
  COMP_NEPHROPATHY: 'Diabetic nephropathy',
  COMP_NEUROPATHY: 'Diabetic neuropathy',
  COMP_RETINOPATHY: 'Diabetic retinopathy',
};

export const labelFor = (key) => FEATURE_LABELS[key] || key;

// Clinically modifiable features — those a clinician can act on directly through
// medication adjustment, complications screening, polypharmacy review, or
// discharge planning. AGE and SEX_M are the only intrinsic (non-modifiable)
// attributes; complications are listed as modifiable because progression can be
// managed even when existing damage cannot be undone.
export const MODIFIABLE_FEATURES = new Set([
  'Avg_LOS', 'Total_Meds_Count', 'Total_Unique_Diagnoses', 'Severity_Encoded', 'Num_Visits',
  'MED_ALPHA_GLUCOSIDE_INHIBITORS', 'MED_BIGUANIDE', 'MED_COMBINATION_DRUG',
  'MED_DPP_4_INHIBITORS', 'MED_GLP_1_RECEPTOR_AGONISTS', 'MED_INSULIN_THERAPY',
  'MED_MEGLITINIDES', 'MED_SGLT_2_INHIBITORS', 'MED_SULPHONYLUREAS', 'MED_THIAZOLIDINEDIONES',
  'COMP_DIABETIC_FOOT', 'COMP_MACROVASCULAR', 'COMP_NEPHROPATHY', 'COMP_NEUROPATHY', 'COMP_RETINOPATHY',
]);

export const isModifiable = (key) => MODIFIABLE_FEATURES.has(key);

// Format a feature's raw value for display in per-patient SHAP rows.
// Binary medication / complication flags render as Yes/No; numerics keep their
// natural representation (rounded for floats, raw for ints).
export const formatFeatureValue = (key, value) => {
  if (value === null || value === undefined) return '—';
  if (key.startsWith('MED_') || key.startsWith('COMP_') || key === 'SEX_M') {
    return value >= 0.5 ? 'Yes' : 'No';
  }
  if (key === 'Severity_Encoded') {
    return ['Mild', 'Moderate', 'Severe'][Math.round(value)] || String(value);
  }
  if (key === 'AGE' || key === 'Num_Visits' || key === 'Total_Meds_Count' || key === 'Total_Unique_Diagnoses') {
    return String(Math.round(value));
  }
  if (key === 'Avg_LOS') {
    return `${Number(value).toFixed(1)} days`;
  }
  return typeof value === 'number' ? value.toFixed(2) : String(value);
};

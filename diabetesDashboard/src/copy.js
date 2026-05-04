// Plain-English explanations surfaced via <InfoTip> on titles and KPI labels.
// Detail lines (when present) carry the precise model-internal value so clinicians
// can opt into the technical answer without it polluting the always-visible chrome.

export const TIPS = {
  cohort_overview: {
    text: 'Filtered subset of the full 62,135-patient cohort. Updates when you change the gender or severity filters or click a chart segment.',
  },
  active_filter_cohort: {
    text: 'Number of patients matching the active filters.',
  },
  avg_admission_risk: {
    text: 'Mean predicted probability that a patient in this cohort will be admitted to hospital.',
    detail: 'A patient is flagged for admission when their individual score reaches the threshold of 68.7% (XGBoost, F1-optimised on training data).',
  },
  readmit_conversion: {
    text: 'Of the patients flagged for admission, the share whose readmission probability also exceeds the readmission threshold.',
    detail: 'Readmission threshold: 33.9% (XGBoost, F1-optimised). Computed only across patients already flagged for admission.',
  },
  age_band_chart: {
    text: 'Average predicted admission risk in 10-year age buckets across the active cohort. Click any band to filter the dashboard to those patients.',
  },
  cohort_drivers: {
    text: "The eight features that appear most often in patients' top-3 SHAP risk drivers across the active cohort.",
    detail: 'Source: per-patient TreeExplainer SHAP from the admission XGBoost model.',
  },
  risk_distribution: {
    text: 'Patients grouped by predicted admission risk in 10-percentage-point bands. The vertical line marks the threshold above which the model flags a patient for admission. Click a band to filter.',
    detail: 'Admission threshold: 68.7%.',
  },
  severity_sex_matrix: {
    text: 'Patient counts and average admission risk broken down by clinical severity and gender. Click any cell to filter.',
  },
  shap_admission_global: {
    text: "These features had the strongest overall influence on the admission model's predictions. Larger bars mean the feature had a larger average impact on risk scores.",
    detail: 'Computed from a deterministic 3,000-patient sample (seed 42) via TreeExplainer.',
  },
  shap_admission_patient: {
    text: "How each feature pushed THIS patient's predicted admission risk up or down. Red bars increase risk; blue bars reduce it. The grey value beside each row is the patient's actual recorded value.",
  },
  shap_readmission_global: {
    text: "These features had the strongest overall influence on the readmission model's predictions, computed only across patients flagged for admission.",
    detail: 'Computed from a deterministic 3,000-patient sample (seed 42) via TreeExplainer on the readmission model.',
  },
  shap_readmission_patient: {
    text: "How each feature pushed THIS patient's predicted readmission risk up or down. Shown only for patients flagged for admission by the Stage 1 model.",
  },
  patient_admission_drivers: {
    text: 'Top contributors to this patient’s predicted admission risk, drawn from the admission model’s SHAP values.',
  },
  patient_readmission_drivers: {
    text: 'Top contributors to this patient’s predicted readmission risk, drawn from the readmission model’s SHAP values. Only shown when the patient is flagged for admission.',
  },
  about_model: {
    text: 'A short summary of how the predictions are produced and what their limits are.',
  },
  severity_logic: {
    text: "Severity is assigned by a fixed clinical heuristic, not by the model. 'Severe' if the patient is on insulin therapy. 'Mild' if no diabetes medications are recorded, or only biguanide (e.g., metformin). 'Moderate' otherwise.",
  },
  patient_percentile: {
    text: "Where this patient ranks against the rest of the cohort by predicted risk. 90th percentile means 90% of patients have a lower predicted score.",
  },
  modifiable_drivers: {
    text: 'Drivers tagged "Modifiable" represent factors a clinician can address through medication adjustment, complications screening, or discharge planning. "Intrinsic" drivers (age, sex) are fixed patient attributes and cannot be acted on directly.',
  },
};

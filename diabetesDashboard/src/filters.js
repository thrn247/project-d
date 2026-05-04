// Cross-filter utilities. Lifted state lives in App.jsx; consumers read filters
// via prop and dispatch through updateFilters / clearAllFilters.
//
// Filter dimensions (all AND-combined):
//   gender    : 'All' | 'M' | 'F'
//   severity  : 'All' | 'Severe' | 'Moderate' | 'Mild'
//   ageBand   : null | '<40' | '40-49' | '50-59' | '60-69' | '70-79' | '80+'
//   riskBand  : null | '0-10%' | '10-20%' | ... | '90-100%'
//
// applyFilters supports a per-call exclude list so individual charts can
// "exclude self" — e.g., the histogram still shows all bins even when a
// riskBand filter is active.

export const EMPTY_FILTERS = {
  gender: 'All',
  severity: 'All',
  ageBand: null,
  riskBand: null,
};

export const ageBandFor = (age) => {
  if (age < 40) return '<40';
  if (age < 50) return '40-49';
  if (age < 60) return '50-59';
  if (age < 70) return '60-69';
  if (age < 80) return '70-79';
  return '80+';
};

export const riskBandFor = (score) => {
  const pct = (score || 0) * 100;
  const idx = Math.min(9, Math.max(0, Math.floor(pct / 10)));
  return `${idx * 10}-${(idx + 1) * 10}%`;
};

export const isFilterActive = (filters) =>
  filters.gender !== 'All' ||
  filters.severity !== 'All' ||
  filters.ageBand !== null ||
  filters.riskBand !== null;

export const applyFilters = (data, filters, exclude) => {
  const ex = Array.isArray(exclude) ? new Set(exclude) : (exclude ? new Set([exclude]) : new Set());
  let rs = data;
  if (filters.gender !== 'All' && !ex.has('gender')) {
    rs = rs.filter(d => d.Sex === filters.gender);
  }
  if (filters.severity !== 'All' && !ex.has('severity')) {
    rs = rs.filter(d => d.Severity === filters.severity);
  }
  if (filters.ageBand !== null && !ex.has('ageBand')) {
    rs = rs.filter(d => ageBandFor(d.Age) === filters.ageBand);
  }
  if (filters.riskBand !== null && !ex.has('riskBand')) {
    rs = rs.filter(d => riskBandFor(d.Stage_1_Admission_Risk) === filters.riskBand);
  }
  return rs;
};

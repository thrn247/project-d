import React, { useMemo } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { AnimatePresence, motion } from 'motion/react';
import { Filter, ChevronDown, X, ArrowRight, ArrowLeft, Download, Search } from 'lucide-react';
import { applyFilters, isFilterActive } from '../filters';

// PascalCase aliases — eslint's no-unused-vars doesn't trace JSX member
// expressions on lowercase identifiers (`<motion.div>`), so we surface the
// component bindings explicitly here.
const MotionDiv = motion.div;
const MotionButton = motion.button;

// Single source of truth for the cohort filter UI. Replaces three previously
// separate UIs: bare <select>s in EDAView, severity-pill tabs in
// PredictionsDirectory, and the FilterChips active-filter strip. Sticky to
// the top of the .main-content scroll viewport so the controls stay
// reachable through long table scrolls.
//
// Each dropdown trigger doubles as the active-filter chip — when a non-default
// value is set, the trigger lights up with primary color and a small ✕ button
// clears just that dimension. Cleaner than maintaining a separate chip strip.

const GENDER_OPTIONS = [
  { value: 'All', label: 'All Genders' },
  { value: 'M', label: 'Male' },
  { value: 'F', label: 'Female' },
];

const SEVERITY_OPTIONS = [
  { value: 'All', label: 'All Severities' },
  { value: 'Severe', label: 'Severe Risk' },
  { value: 'Moderate', label: 'Moderate Risk' },
  { value: 'Mild', label: 'Mild Risk' },
];

const AGE_OPTIONS = [
  { value: null, label: 'All Ages' },
  { value: '<40', label: '<40' },
  { value: '40-49', label: '40-49' },
  { value: '50-59', label: '50-59' },
  { value: '60-69', label: '60-69' },
  { value: '70-79', label: '70-79' },
  { value: '80+', label: '80+' },
];

const RISK_OPTIONS = [
  { value: null, label: 'All Risk Bands' },
  ...Array.from({ length: 10 }, (_, i) => ({
    value: `${i * 10}-${(i + 1) * 10}%`,
    label: `${i * 10}–${(i + 1) * 10}%`,
  })),
];

// null is a valid filter value (no selection), but Radix RadioGroup needs
// strings. We sentinel-encode null as "__null__" round-trip.
const toRadioValue = (v) => v === null ? '__null__' : String(v);
const fromRadioValue = (v) => v === '__null__' ? null : v;

function FilterDropdown({ label, value, defaultValue, options, onChange }) {
  const isActive = value !== defaultValue;
  const currentOption = options.find(o => o.value === value);
  const triggerLabel = isActive
    ? `${label}: ${currentOption?.label ?? ''}`
    : label;

  return (
    <MotionDiv
      layout
      transition={{ duration: 0.2, ease: [0.25, 0.8, 0.25, 1] }}
      className={`cfb-dropdown-group ${isActive ? 'cfb-dropdown-group--active' : ''}`}
    >
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="cfb-dropdown-trigger"
            aria-label={`${label} filter${isActive ? `, current value ${currentOption?.label}` : ''}`}
          >
            <span>{triggerLabel}</span>
            <ChevronDown size={13} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="radix-dropdown-content"
            sideOffset={6}
            align="start"
            collisionPadding={12}
          >
            <DropdownMenu.RadioGroup
              value={toRadioValue(value)}
              onValueChange={(v) => onChange(fromRadioValue(v))}
            >
              {options.map(opt => (
                <DropdownMenu.RadioItem
                  key={toRadioValue(opt.value)}
                  value={toRadioValue(opt.value)}
                  className="radix-dropdown-item"
                >
                  {opt.label}
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <AnimatePresence initial={false}>
        {isActive && (
          <MotionButton
            key="clear"
            type="button"
            className="cfb-dropdown-clear"
            onClick={() => onChange(defaultValue)}
            aria-label={`Clear ${label} filter`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <X size={11} />
          </MotionButton>
        )}
      </AnimatePresence>
    </MotionDiv>
  );
}

export default function CohortFilterBar({
  data,
  filters,
  updateFilters,
  clearAllFilters,
  variant,                    // 'eda' | 'predictions'
  topDriverLabel,             // optional, EDA only
  onJumpToPredictions,        // optional, EDA only
  onJumpToEDA,                // optional, Predictions only
  searchQuery,                // optional, Predictions only
  onSearchChange,             // optional, Predictions only
  onExportCSV,                // optional, Predictions only
}) {
  const filtersActive = isFilterActive(filters);
  const isPredictions = variant === 'predictions';

  // Cohort summary computations live here so the bar is self-sufficient and
  // identical across both tabs.
  const filteredData = useMemo(
    () => applyFilters(data, filters),
    [data, filters]
  );
  const totalCount = filteredData.length;
  const globalCount = data.length;
  const cohortPct = globalCount > 0 ? (totalCount / globalCount) * 100 : 0;

  const cohortPredictedAdmittedPct = useMemo(() => {
    if (totalCount === 0) return 0;
    return (filteredData.filter(d => d.Predicted_Admission === 1).length / totalCount) * 100;
  }, [filteredData, totalCount]);

  const globalPredictedAdmittedPct = useMemo(() => {
    if (globalCount === 0) return 0;
    return (data.filter(d => d.Predicted_Admission === 1).length / globalCount) * 100;
  }, [data, globalCount]);

  return (
    <div className="cohort-filter-bar">
      <div className="cohort-filter-bar__row">
        <div className="cohort-filter-bar__filters">
          <span className="cohort-filter-bar__label"><Filter size={14} /> Filter</span>
          <FilterDropdown
            label="Gender"
            value={filters.gender}
            defaultValue="All"
            options={GENDER_OPTIONS}
            onChange={(v) => updateFilters({ gender: v })}
          />
          <FilterDropdown
            label="Severity"
            value={filters.severity}
            defaultValue="All"
            options={SEVERITY_OPTIONS}
            onChange={(v) => updateFilters({ severity: v })}
          />
          <FilterDropdown
            label="Age"
            value={filters.ageBand}
            defaultValue={null}
            options={AGE_OPTIONS}
            onChange={(v) => updateFilters({ ageBand: v })}
          />
          <FilterDropdown
            label="Risk"
            value={filters.riskBand}
            defaultValue={null}
            options={RISK_OPTIONS}
            onChange={(v) => updateFilters({ riskBand: v })}
          />
        </div>

        <div className="cohort-filter-bar__actions">
          {isPredictions && onSearchChange && (
            <div className="cfb-search">
              <Search size={14} />
              <input
                type="text"
                value={searchQuery || ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search Patient ID..."
                aria-label="Search by Patient ID"
              />
            </div>
          )}
          {filtersActive && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="cfb-clear-all"
            >
              Clear all
            </button>
          )}
          {variant === 'eda' && onJumpToPredictions && filtersActive && totalCount > 0 && (
            <button
              type="button"
              onClick={onJumpToPredictions}
              className="cfb-jump"
            >
              View {totalCount.toLocaleString()} <ArrowRight size={14} />
            </button>
          )}
          {variant === 'predictions' && onJumpToEDA && (
            <button
              type="button"
              onClick={onJumpToEDA}
              className="cfb-jump cfb-jump--reverse"
            >
              <ArrowLeft size={14} /> View as Cohort
            </button>
          )}
          {isPredictions && onExportCSV && (
            <button
              type="button"
              onClick={onExportCSV}
              className="cfb-export"
            >
              <Download size={14} /> Export CSV
            </button>
          )}
        </div>
      </div>

      {filtersActive && totalCount > 0 && (
        <div className="cohort-filter-bar__summary">
          <strong>{totalCount.toLocaleString()} patients</strong> in this filter
          {' '}({cohortPct.toFixed(1)}% of cohort).
          {variant === 'eda' && (
            <>
              {' '}
              <strong style={{ color: cohortPredictedAdmittedPct > globalPredictedAdmittedPct ? 'var(--danger)' : 'var(--text-main)' }}>
                {cohortPredictedAdmittedPct.toFixed(1)}% predicted admitted
              </strong>
              {' '}(vs {globalPredictedAdmittedPct.toFixed(1)}% across all {globalCount.toLocaleString()} patients).
            </>
          )}
          {variant === 'eda' && topDriverLabel && (
            <> Most common driver: <strong>{topDriverLabel}</strong>.</>
          )}
        </div>
      )}
    </div>
  );
}

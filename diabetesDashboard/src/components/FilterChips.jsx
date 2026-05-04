import React from 'react';
import { X, ArrowRight } from 'lucide-react';
import { isFilterActive } from '../filters';

// Active-filter chip strip — shown above charts/table whenever any cross-filter
// is applied. Each chip clears its own dimension; "Clear all" resets everything.
// `onJumpToPredictions` (optional) renders a drill-down button when provided.
export default function FilterChips({
  filters,
  updateFilters,
  clearAllFilters,
  totalCount,
  onJumpToPredictions,
  surface = 'normal', // 'normal' | 'compact'
}) {
  if (!isFilterActive(filters)) return null;

  const chips = [];
  if (filters.gender !== 'All') {
    chips.push({
      key: 'gender',
      label: `Sex: ${filters.gender === 'M' ? 'Male' : 'Female'}`,
      clear: () => updateFilters({ gender: 'All' }),
    });
  }
  if (filters.severity !== 'All') {
    chips.push({
      key: 'severity',
      label: `Severity: ${filters.severity}`,
      clear: () => updateFilters({ severity: 'All' }),
    });
  }
  if (filters.ageBand !== null) {
    chips.push({
      key: 'ageBand',
      label: `Age: ${filters.ageBand}`,
      clear: () => updateFilters({ ageBand: null }),
    });
  }
  if (filters.riskBand !== null) {
    chips.push({
      key: 'riskBand',
      label: `Risk: ${filters.riskBand}`,
      clear: () => updateFilters({ riskBand: null }),
    });
  }

  const compact = surface === 'compact';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        flexWrap: 'wrap',
        padding: compact ? '0.6rem 1rem' : '0.85rem 1.25rem',
        background: 'var(--primary-container)',
        border: '1px solid var(--primary)',
        borderRadius: '0.75rem',
        marginBottom: compact ? '1rem' : '2rem',
      }}
    >
      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)', marginRight: '0.25rem' }}>
        Active filters
      </span>
      {chips.map(chip => (
        <button
          key={chip.key}
          onClick={chip.clear}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            background: 'var(--bg-card)', border: '1px solid var(--primary)',
            color: 'var(--primary)', padding: '0.3rem 0.7rem',
            borderRadius: '999px', cursor: 'pointer', fontSize: '0.78rem',
            fontWeight: 500, fontFamily: 'Inter, sans-serif',
            transition: 'var(--transition)',
          }}
          aria-label={`Remove filter ${chip.label}`}
        >
          {chip.label}
          <X size={11} />
        </button>
      ))}
      <button
        onClick={clearAllFilters}
        style={{
          marginLeft: '0.25rem',
          background: 'transparent', border: 'none',
          color: 'var(--primary)', cursor: 'pointer',
          fontSize: '0.78rem', fontWeight: 600,
          fontFamily: 'Inter, sans-serif',
          textDecoration: 'underline',
          padding: '0.3rem 0.4rem',
        }}
      >
        Clear all
      </button>
      {onJumpToPredictions && typeof totalCount === 'number' && (
        <button
          onClick={onJumpToPredictions}
          style={{
            marginLeft: 'auto',
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            background: 'var(--primary)', color: '#fff', border: 'none',
            padding: '0.5rem 1rem', borderRadius: '0.6rem',
            cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
            fontFamily: 'Inter, sans-serif',
            transition: 'var(--transition)',
            boxShadow: '0 4px 12px var(--primary-glow)',
          }}
        >
          View {totalCount.toLocaleString()} in Predictions
          <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}

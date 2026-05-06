import React from 'react';

// Shared empty-state panel — replaces the three near-duplicate blocks that
// previously lived inline in EDAView, PredictionsDirectory (table), and
// PredictionsDirectory (grid). Keep it visually neutral so it composes inside
// any container (card, table cell, grid).
export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        borderRadius: '1.25rem',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--glass-shadow)',
        padding: '4rem 2rem',
        textAlign: 'center',
      }}
    >
      {Icon && (
        <Icon
          size={48}
          color="var(--text-muted)"
          style={{ opacity: 0.4, marginBottom: '1rem' }}
        />
      )}
      <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-main)' }}>{title}</h3>
      {description && (
        <p style={{ color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
          {description}
        </p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          style={{
            background: 'var(--primary)',
            color: '#fff',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.6rem',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 600,
            fontFamily: 'Inter, sans-serif',
            transition: 'var(--transition)',
            boxShadow: '0 4px 12px var(--primary-glow)',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

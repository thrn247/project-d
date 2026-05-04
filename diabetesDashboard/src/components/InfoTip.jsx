import React, { useState, useId } from 'react';
import { Info } from 'lucide-react';

// Lightweight info-icon-with-tooltip. No popper.js / no portal — just an absolutely
// positioned div that flips above the icon when there's no room below.
//
// Hover OR keyboard-focus reveals the tooltip; Escape collapses it. Used liberally
// on titles + KPI labels so clinicians can self-serve "what does this mean?" without
// crowding the always-visible chrome.
export default function InfoTip({ text, detail, size = 14, placement = 'bottom' }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  if (!text) return null;

  const onKey = (e) => {
    if (e.key === 'Escape') setOpen(false);
  };

  const above = placement === 'top';

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}>
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(o => !o)}
        onKeyDown={onKey}
        aria-describedby={open ? id : undefined}
        aria-label="More information"
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: '0 0 0 0.35rem',
          cursor: 'help',
          color: 'var(--text-muted)',
          display: 'inline-flex',
          alignItems: 'center',
          lineHeight: 1,
        }}
      >
        <Info size={size} />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          style={{
            position: 'absolute',
            [above ? 'bottom' : 'top']: 'calc(100% + 8px)',
            left: 0,
            zIndex: 200,
            width: '280px',
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            padding: '0.75rem 0.85rem',
            borderRadius: '0.6rem',
            border: '1px solid var(--border-light)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.15)',
            fontSize: '0.82rem',
            fontFamily: 'Inter, sans-serif',
            lineHeight: 1.45,
            fontWeight: 400,
            textTransform: 'none',
            letterSpacing: 'normal',
            pointerEvents: 'none',
          }}
        >
          <span style={{ display: 'block' }}>{text}</span>
          {detail && (
            <span
              style={{
                display: 'block',
                marginTop: '0.5rem',
                paddingTop: '0.5rem',
                borderTop: '1px solid var(--border-light)',
                color: 'var(--text-muted)',
                fontSize: '0.75rem',
              }}
            >
              {detail}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

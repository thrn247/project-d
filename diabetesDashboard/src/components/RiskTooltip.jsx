import React from 'react';

// Shared Recharts tooltip for all charts in the dashboard. Use as the
// `content` prop on a <Tooltip>; the chart-specific call site supplies
// `title`, `items`, and an optional `footer` (e.g., a "Click to filter"
// hint on cross-filter charts). Visual style matches the `.glass-card`
// surface — same border radius, border color, and shadow.
//
// Usage in a Recharts chart:
//   <Tooltip content={(props) => (
//     <RiskTooltip
//       {...props}
//       title={`Age ${props.payload?.[0]?.payload.name}`}
//       items={[{ text: `${count.toLocaleString()} patients`, tone: 'meta' }]}
//       footer={`Click to filter cohort`}
//     />
//   )} />
export default function RiskTooltip({ active, payload, title, items, footer }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="risk-tooltip">
      {title && <div className="risk-tooltip__title">{title}</div>}
      {items && items.map((line, i) => (
        <div key={i} className={`risk-tooltip__line risk-tooltip__line--${line.tone || 'meta'}`}>
          {line.text}
        </div>
      ))}
      {footer && <div className="risk-tooltip__footer">{footer}</div>}
    </div>
  );
}

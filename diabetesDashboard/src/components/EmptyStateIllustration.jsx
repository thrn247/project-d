import React, { useId } from 'react';

// Brand-gradient SVG used by EmptyState in place of a generic lucide icon.
// Stylised magnifying-glass — outer circle + handle in solid gradient
// stroke, inner circle dashed and translucent to suggest "no match found".
// Uses --primary and --accent-violet via the brand gradient stop colours.
export default function EmptyStateIllustration({ size = 48, className }) {
  const gradientId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--accent-violet)" />
        </linearGradient>
      </defs>
      {/* Outer ring */}
      <circle
        cx="22"
        cy="22"
        r="14"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.5"
      />
      {/* Magnifying glass handle */}
      <line
        x1="32"
        y1="32"
        x2="40"
        y2="40"
        stroke={`url(#${gradientId})`}
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Inner translucent fill */}
      <circle
        cx="22"
        cy="22"
        r="6"
        fill={`url(#${gradientId})`}
        opacity="0.15"
      />
      {/* Inner dashed ring — "looking for something that's not there" */}
      <circle
        cx="22"
        cy="22"
        r="6"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.5"
        strokeDasharray="3 2"
      />
    </svg>
  );
}

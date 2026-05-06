import React from 'react';
import { Info } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';

// Info-icon-with-tooltip — wraps Radix Tooltip while keeping the original
// (text, detail, size, placement) prop API so the 18 existing call sites
// don't change. Radix gives us proper portalling (no overflow:hidden clipping),
// collision detection, and Escape-to-dismiss for free.
//
// Behaviour change vs the hand-rolled version: opens on hover/focus and on
// touch-tap; the previous explicit click-toggle is gone (Radix Tooltip is
// hover-first by design). Mobile tap still works because Radix handles touch
// as an instant-open event.
export default function InfoTip({ text, detail, size = 14, placement = 'bottom' }) {
  if (!text) return null;

  return (
    <Tooltip.Root delayDuration={150}>
      <Tooltip.Trigger asChild>
        <button
          type="button"
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
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={placement}
          sideOffset={8}
          collisionPadding={12}
          className="radix-tooltip-content"
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
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

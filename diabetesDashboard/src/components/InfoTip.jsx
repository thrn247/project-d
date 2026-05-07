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
        <button type="button" aria-label="More information" className="info-tip-trigger">
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
          <span className="info-tip-text">{text}</span>
          {detail && <span className="info-tip-detail">{detail}</span>}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

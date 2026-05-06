import { useEffect, useRef, useState } from 'react';

// Tween a numeric value with requestAnimationFrame + easeOutCubic. Used by the
// EDAView KPIs so percentages and counts ease into their new value when the
// active filter changes, instead of snapping. Respects the user's
// prefers-reduced-motion setting (snaps immediately when reduce is on).
//
// All setState calls happen inside an rAF callback so the hook stays clear of
// the react-hooks/set-state-in-effect lint.
export function useNumberTween(target, durationMs = 600) {
  const [displayValue, setDisplayValue] = useState(target);
  const displayRef = useRef(target);

  // Keep ref aligned with the rendered value so the next animation tween
  // starts from where the previous one left off (not from stale state).
  useEffect(() => {
    displayRef.current = displayValue;
  });

  useEffect(() => {
    const prefersReduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const from = displayRef.current;
    const start = performance.now();
    let raf;

    const tick = (now) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      const eased = prefersReduce ? 1 : 1 - Math.pow(1 - t, 3);
      setDisplayValue(from + (target - from) * eased);
      if (t < 1 && !prefersReduce) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return displayValue;
}

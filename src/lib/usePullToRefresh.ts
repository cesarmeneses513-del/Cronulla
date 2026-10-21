import { useEffect, useRef, useState } from 'react';

// How far (px) the finger must pull the page down from the top to refresh, and the most it moves.
const TRIGGER = 70;
const MAX = 100;

// Inside an open dialog, sheet or photo viewer (they are position: fixed): the pull belongs to it.
const insideFixed = (el: EventTarget | null) => {
  for (let n = el instanceof Element ? el : null; n && n !== document.body; n = n.parentElement) {
    if (getComputedStyle(n).position === 'fixed') return true;
  }
  return false;
};

// Phones and tablets: pulling the page down from the very top and letting go calls `onRefresh`.
// Returns how far it is pulled now (0 when not pulling), for the indicator.
export function usePullToRefresh(onRefresh: () => void, enabled: boolean): number {
  const [pull, setPull] = useState(0);
  const pullRef = useRef(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled || !window.matchMedia('(pointer: coarse)').matches) return;
    const set = (v: number) => {
      pullRef.current = v;
      setPull(v);
    };
    const onStart = (e: TouchEvent) => {
      start.current =
        e.touches.length === 1 && window.scrollY <= 0 && !insideFixed(e.target)
          ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
          : null;
    };
    const onMove = (e: TouchEvent) => {
      if (!start.current) return;
      const dy = e.touches[0].clientY - start.current.y;
      const dx = Math.abs(e.touches[0].clientX - start.current.x);
      // Scrolling up, or sideways (photo rows): not a pull.
      if (dy <= 0 || (pullRef.current === 0 && dx > dy)) {
        start.current = null;
        if (pullRef.current) set(0);
        return;
      }
      if (window.scrollY > 0) return;
      e.preventDefault(); // the page itself doesn't bounce while pulling
      set(Math.min(dy * 0.5, MAX));
    };
    const onEnd = () => {
      if (start.current && pullRef.current >= TRIGGER) refreshRef.current();
      start.current = null;
      if (pullRef.current) set(0);
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled]);

  return pull;
}

export const PULL_TRIGGER = TRIGGER;

import { useEffect, useRef, useState } from 'react';

// How far (px) the finger must pull the page down from the top to refresh, and the most it moves.
const TRIGGER = 70;
const MAX = 100;
// Movement (px) before deciding whether the finger is pulling down, scrolling or swiping sideways.
const SLOP = 10;

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
        e.touches.length === 1 && window.scrollY <= 1 && !insideFixed(e.target)
          ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
          : null;
    };
    const onMove = (e: TouchEvent) => {
      if (!start.current) return;
      const dy = e.touches[0].clientY - start.current.y;
      const dx = Math.abs(e.touches[0].clientX - start.current.x);
      if (pullRef.current === 0) {
        // A real finger wobbles at first: decide only once it has moved a little.
        if (Math.max(Math.abs(dy), dx) < SLOP) return;
        // Scrolling up, or sideways (photo rows): not a pull.
        if (dy <= 0 || dx > dy || window.scrollY > 1) {
          start.current = null;
          return;
        }
      }
      e.preventDefault(); // the page itself doesn't bounce while pulling
      // Pulled back up: the indicator follows (letting go there doesn't refresh).
      set(Math.max(0, Math.min((dy - SLOP) * 0.5, MAX)));
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

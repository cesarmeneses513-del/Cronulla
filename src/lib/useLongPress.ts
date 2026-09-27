import type React from 'react';
import { useRef } from 'react';

// Touch long-press (phones and tablets). Mouse clicks are left alone. Moving the finger (scrolling)
// cancels it, and the tap that ends a long-press doesn't also click whatever is underneath.
// Browsers show their own long-press menu (and may cancel the touch) at about the same time, so
// that "contextmenu" event also counts as the long-press.
export function useLongPress(onLongPress?: () => void, ms = 500) {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number; at: number } | null>(null);
  const fired = useRef(false);
  if (!onLongPress) return {};

  const fire = () => {
    window.clearTimeout(timer.current);
    if (fired.current) return;
    fired.current = true;
    start.current = null;
    onLongPress();
  };
  const cancel = () => {
    window.clearTimeout(timer.current);
    start.current = null;
  };

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY, at: Date.now() };
      timer.current = window.setTimeout(fire, ms);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) cancel();
    },
    onPointerUp: cancel,
    // A cancelled touch (the browser took over) keeps `start` so its long-press menu event still counts.
    onPointerCancel: () => window.clearTimeout(timer.current),
    onContextMenu: (e: React.MouseEvent) => {
      if (fired.current || (start.current && Date.now() - start.current.at > 300)) {
        e.preventDefault();
        fire();
      }
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (fired.current) {
        e.preventDefault();
        e.stopPropagation();
        fired.current = false;
      }
    },
  };
}

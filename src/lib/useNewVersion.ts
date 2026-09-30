import { useEffect, useState } from 'react';

// The built script this page is running (e.g. "index-C0V6amX4.js"). Null in development.
const bundleOf = (html: string) => html.match(/\/assets\/(index-[\w-]+\.js)/)?.[1] ?? null;
const RUNNING = (() => {
  const src = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]')?.src;
  return src ? bundleOf(src) : null;
})();

// True once a newer version of the app has been published. Checked every few minutes, and when
// the page is shown again or comes back online (phones keep old tabs open for days).
export function useNewVersion(intervalMs = 2 * 60 * 1000): boolean {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!RUNNING || available) return;
    let stopped = false;
    const check = async () => {
      try {
        const res = await fetch(`/?v=${Date.now()}`, { cache: 'no-store' });
        const latest = bundleOf(await res.text());
        if (!stopped && latest && latest !== RUNNING) setAvailable(true);
      } catch {
        // Offline: try again later.
      }
    };
    const onVisible = () => document.visibilityState === 'visible' && check();
    const timer = window.setInterval(check, intervalMs);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', check);
    check();
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', check);
    };
  }, [intervalMs, available]);

  return available;
}

// Realtime fallback poller used across all chat surfaces (re-sync nudge).
import { useEffect, useRef } from 'react';

/**
 * Realtime fallback poller.
 *
 * The app's primary realtime mechanism is the Base44 websocket (`db.X.subscribe`).
 * When that socket is silent (proxy / network / deployment quirks), new messages
 * only show up on a manual page refresh. This hook closes that gap: it calls
 * `callback` on a fixed interval so every chat surface eventually pulls fresh data
 * on its own — no refresh needed — while the websocket still provides the instant
 * update whenever it does fire.
 *
 * It is visibility-aware: polling pauses while the tab is hidden (so a backgrounded
 * tab doesn't burn requests) and fires once immediately when the tab is shown again
 * so the user sees the latest state the moment they come back.
 *
 * NOTE on interval choice: `db.list/filter` cache an in-flight request for ~5s
 * (see lib/db.js). Keep intervals >5s so each poll fetches fresh data rather than
 * a cached promise.
 *
 * @param {() => void} callback   Loader to run each tick (kept in a ref — no need to memoize).
 * @param {number} [intervalMs=6000]
 * @param {boolean} [enabled=true]
 */
export function usePolling(callback, intervalMs = 6000, enabled = true) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!enabled) return undefined;

    let timer = null;
    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      cbRef.current?.();
    };
    const start = () => { if (!timer) timer = setInterval(tick, intervalMs); };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };

    const handleVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        cbRef.current?.(); // catch up the moment the tab is focused again
        start();
      }
    };

    start();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [intervalMs, enabled]);
}

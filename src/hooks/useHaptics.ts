import { useEffect } from 'react';

interface Options {
  /** vibration pattern – defaults to a short "tick" */
  pattern?: number | number[];
  /** whether the user explicitly enabled haptics in their settings */
  enabled?: boolean;
}

/**
 * Call inside any component when you want to trigger a vibration:
 *
 *   useHaptics({ enabled: mySettings.haptics }, [triggerVariable]);
 *
 * The hook will *only* vibrate when the dependency array changes.
 */
export function useHaptics(opts: Options, deps: unknown[] = []) {
  const { pattern = 8, enabled = true } = opts;

  useEffect(() => {
    // Hook must be called unconditionally - move guards inside
    if (!enabled || typeof window === 'undefined' || !navigator.vibrate) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    navigator.vibrate(pattern);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
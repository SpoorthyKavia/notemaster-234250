import { useEffect, useMemo, useRef, useState } from 'react';
import { safeJsonParse } from '../utils/noteUtils';

/**
 * PUBLIC_INTERFACE
 * useLocalStorageState keeps a piece of state persisted to localStorage.
 * Includes optional debounced writes to support autosave flows.
 *
 * @template T
 * @param {string} key localStorage key
 * @param {T} initialValue initial value (or function returning initial)
 * @param {{debounceMs?: number, version?: number}} [options]
 * @returns {[T, import('react').Dispatch<import('react').SetStateAction<T>>]}
 */
export function useLocalStorageState(key, initialValue, options = {}) {
  const { debounceMs = 250, version = 1 } = options;

  const initial = useMemo(() => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return typeof initialValue === 'function' ? initialValue() : initialValue;

    const parsed = safeJsonParse(raw, null);
    if (!parsed || typeof parsed !== 'object') {
      return typeof initialValue === 'function' ? initialValue() : initialValue;
    }

    // Allow for future migrations.
    if (parsed._v !== version) {
      return typeof initialValue === 'function' ? initialValue() : initialValue;
    }

    return parsed.data ?? (typeof initialValue === 'function' ? initialValue() : initialValue);
  }, [initialValue, key, version]);

  const [state, setState] = useState(initial);
  const writeTimerRef = useRef(null);

  useEffect(() => {
    if (writeTimerRef.current) {
      window.clearTimeout(writeTimerRef.current);
    }

    writeTimerRef.current = window.setTimeout(() => {
      const payload = JSON.stringify({ _v: version, data: state });
      window.localStorage.setItem(key, payload);
    }, debounceMs);

    return () => {
      if (writeTimerRef.current) window.clearTimeout(writeTimerRef.current);
    };
  }, [debounceMs, key, state, version]);

  return [state, setState];
}

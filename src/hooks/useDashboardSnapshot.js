import { useCallback, useEffect, useRef, useState } from 'react';
import { getDashboardRuntimeConfig } from '../config/runtimeConfig.js';
import { getDashboardSnapshot } from '../services/api.js';

export function useDashboardSnapshot(options = {}) {
  const loadSnapshot = options.loadSnapshot ?? getDashboardSnapshot;
  const refreshMs = options.refreshMs ?? getDashboardRuntimeConfig().refreshIntervalMs;
  const [snapshot, setSnapshot] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (inFlightRef.current) return false;
    inFlightRef.current = true;
    if (!silent) setIsRefreshing(true);
    try {
      const nextSnapshot = await loadSnapshot();
      if (!mountedRef.current) return false;
      setSnapshot(nextSnapshot);
      setError(null);
      setLastUpdatedAt(new Date().toISOString());
      return true;
    } catch (nextError) {
      if (!mountedRef.current) return false;
      setError(nextError instanceof Error ? nextError : new Error(String(nextError)));
      return false;
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [loadSnapshot]);

  useEffect(() => {
    mountedRef.current = true;
    const initialRefreshId = window.setTimeout(() => refresh(), 0);
    const intervalId = window.setInterval(() => refresh({ silent: true }), refreshMs);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(initialRefreshId);
      window.clearInterval(intervalId);
    };
  }, [refresh, refreshMs]);

  return {
    snapshot,
    isLoading,
    isRefreshing,
    error,
    lastUpdatedAt,
    refresh,
    refreshMs,
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { getDashboardSnapshot } from '../services/api.js';

const DEFAULT_REFRESH_MS = Number(import.meta.env.VITE_DASHBOARD_REFRESH_MS || 30000);

export function useDashboardSnapshot() {
  const [snapshot, setSnapshot] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsRefreshing(true);
    }
    try {
      const nextSnapshot = await getDashboardSnapshot();
      if (!mountedRef.current) return;
      setSnapshot(nextSnapshot);
      setError(null);
      setLastUpdatedAt(new Date().toISOString());
    } catch (nextError) {
      if (!mountedRef.current) return;
      setError(nextError);
    } finally {
      if (!mountedRef.current) return;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    const intervalId = window.setInterval(() => refresh({ silent: true }), DEFAULT_REFRESH_MS);

    return () => {
      mountedRef.current = false;
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  return {
    snapshot,
    isLoading,
    isRefreshing,
    error,
    lastUpdatedAt,
    refresh,
    refreshMs: DEFAULT_REFRESH_MS,
  };
}

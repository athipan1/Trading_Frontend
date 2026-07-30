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
  const controllerRef = useRef(null);

  const refresh = useCallback(async ({ silent = false, cancelPrevious = true } = {}) => {
    if (inFlightRef.current) {
      if (!cancelPrevious) return false;
      controllerRef.current?.abort();
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    inFlightRef.current = true;
    if (!silent) setIsRefreshing(true);
    try {
      const nextSnapshot = await loadSnapshot({ signal: controller.signal });
      if (!mountedRef.current || controller.signal.aborted) return false;
      setSnapshot(nextSnapshot);
      setError(null);
      setLastUpdatedAt(new Date().toISOString());
      return true;
    } catch (nextError) {
      if (!mountedRef.current || controller.signal.aborted || nextError?.name === 'AbortError') return false;
      setError(nextError instanceof Error ? nextError : new Error('Dashboard refresh failed.'));
      return false;
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        inFlightRef.current = false;
        if (mountedRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }
  }, [loadSnapshot]);

  useEffect(() => {
    mountedRef.current = true;
    let intervalId = null;
    const clearPolling = () => {
      if (intervalId !== null) window.clearInterval(intervalId);
      intervalId = null;
    };
    const startPolling = () => {
      clearPolling();
      if (document.hidden) return;
      intervalId = window.setInterval(() => refresh({ silent: true, cancelPrevious: false }), refreshMs);
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        clearPolling();
        controllerRef.current?.abort();
      } else {
        refresh({ silent: true });
        startPolling();
      }
    };
    const initialRefreshId = window.setTimeout(() => refresh(), 0);
    startPolling();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      mountedRef.current = false;
      window.clearTimeout(initialRefreshId);
      clearPolling();
      controllerRef.current?.abort();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refresh, refreshMs]);

  return { snapshot, isLoading, isRefreshing, error, lastUpdatedAt, refresh, refreshMs };
}

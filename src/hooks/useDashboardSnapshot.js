import { useCallback, useEffect, useRef, useState } from 'react';
import { getDashboardRuntimeConfig } from '../config/runtimeConfig.js';
import { getDashboardSnapshot } from '../services/api.js';

export function useDashboardSnapshot(options = {}) {
  const loadSnapshot = options.loadSnapshot ?? getDashboardSnapshot;
  const refreshMs = options.refreshMs ?? getDashboardRuntimeConfig().refreshIntervalMs;
  const refreshOnFocus = options.refreshOnFocus ?? true;
  const staleAfterMs = options.staleAfterMs ?? 0;
  const [snapshot, setSnapshot] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStale, setIsStale] = useState(false);
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
      setIsStale(false);
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
    const initialRefreshId = window.setTimeout(() => refresh(), 0);
    return () => {
      mountedRef.current = false;
      window.clearTimeout(initialRefreshId);
      controllerRef.current?.abort();
    };
  }, [refresh]);

  useEffect(() => {
    let intervalId = null;
    const clearPolling = () => {
      if (intervalId !== null) window.clearInterval(intervalId);
      intervalId = null;
    };
    const startPolling = () => {
      clearPolling();
      if (document.hidden || refreshMs <= 0) return;
      intervalId = window.setInterval(
        () => refresh({ silent: true, cancelPrevious: false }),
        refreshMs,
      );
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        clearPolling();
        controllerRef.current?.abort();
        return;
      }
      if (refreshOnFocus) refresh({ silent: true });
      startPolling();
    };

    startPolling();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearPolling();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refresh, refreshMs, refreshOnFocus]);

  useEffect(() => {
    if (!lastUpdatedAt || staleAfterMs <= 0) {
      setIsStale(false);
      return undefined;
    }
    const staleAt = new Date(lastUpdatedAt).getTime() + staleAfterMs;
    const timerId = window.setTimeout(
      () => setIsStale(true),
      Math.max(0, staleAt - Date.now()),
    );
    return () => window.clearTimeout(timerId);
  }, [lastUpdatedAt, staleAfterMs]);

  return {
    snapshot,
    isLoading,
    isRefreshing,
    isStale,
    error,
    lastUpdatedAt,
    refresh,
    refreshMs,
  };
}

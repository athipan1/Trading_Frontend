import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDashboardSnapshot } from './useDashboardSnapshot.js';
import { normalizeSnapshot } from '../services/api.js';
import { portfolioSnapshot } from '../data/mockPortfolio.js';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
});

describe('useDashboardSnapshot', () => {
  it('refreshes on schedule and preserves the last snapshot after a refresh failure', async () => {
    vi.useFakeTimers();
    const valid = normalizeSnapshot(portfolioSnapshot);
    const loadSnapshot = vi.fn()
      .mockResolvedValueOnce(valid)
      .mockRejectedValueOnce(new Error('snapshot unavailable'));
    const { result } = renderHook(() => useDashboardSnapshot({ loadSnapshot, refreshMs: 5_000 }));

    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(result.current.snapshot).toEqual(valid);
    expect(result.current.error).toBeNull();

    await act(async () => vi.advanceTimersByTimeAsync(5_000));
    expect(loadSnapshot).toHaveBeenCalledTimes(2);
    expect(result.current.snapshot).toEqual(valid);
    expect(result.current.error.message).toBe('snapshot unavailable');
  });

  it('turns polling off when refreshMs is zero', async () => {
    vi.useFakeTimers();
    const valid = normalizeSnapshot(portfolioSnapshot);
    const loadSnapshot = vi.fn().mockResolvedValue(valid);
    renderHook(() => useDashboardSnapshot({ loadSnapshot, refreshMs: 0 }));

    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(loadSnapshot).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(loadSnapshot).toHaveBeenCalledTimes(1);
  });

  it('supports retry and clears a previous error after recovery', async () => {
    const valid = normalizeSnapshot(portfolioSnapshot);
    const loadSnapshot = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(valid);
    const { result } = renderHook(() => useDashboardSnapshot({ loadSnapshot, refreshMs: 900_000 }));

    await waitFor(() => expect(result.current.error?.message).toBe('offline'));
    await act(async () => result.current.refresh());
    expect(result.current.snapshot).toEqual(valid);
    expect(result.current.error).toBeNull();
  });

  it('cancels an older manual request before starting a replacement', async () => {
    const valid = normalizeSnapshot(portfolioSnapshot);
    const signals = [];
    const loadSnapshot = vi.fn(({ signal }) => {
      signals.push(signal);
      if (signals.length === 1) {
        return new Promise((resolve, reject) => signal.addEventListener('abort', () => {
          const error = new Error('cancelled');
          error.name = 'AbortError';
          reject(error);
        }, { once: true }));
      }
      return Promise.resolve(valid);
    });
    const { result } = renderHook(() => useDashboardSnapshot({ loadSnapshot, refreshMs: 900_000 }));
    await waitFor(() => expect(loadSnapshot).toHaveBeenCalledTimes(1));
    await act(async () => result.current.refresh());
    expect(signals[0].aborted).toBe(true);
    expect(result.current.snapshot).toEqual(valid);
    expect(result.current.error).toBeNull();
  });

  it('pauses polling while hidden and resumes with an immediate refresh', async () => {
    vi.useFakeTimers();
    const valid = normalizeSnapshot(portfolioSnapshot);
    const loadSnapshot = vi.fn().mockResolvedValue(valid);
    renderHook(() => useDashboardSnapshot({ loadSnapshot, refreshMs: 5_000 }));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(loadSnapshot).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(loadSnapshot).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });
    expect(loadSnapshot).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(5_000));
    expect(loadSnapshot).toHaveBeenCalledTimes(3);
  });

  it('does not refresh on focus when refreshOnFocus is disabled', async () => {
    vi.useFakeTimers();
    const valid = normalizeSnapshot(portfolioSnapshot);
    const loadSnapshot = vi.fn().mockResolvedValue(valid);
    renderHook(() => useDashboardSnapshot({
      loadSnapshot,
      refreshMs: 0,
      refreshOnFocus: false,
    }));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(loadSnapshot).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });
    expect(loadSnapshot).toHaveBeenCalledTimes(1);
  });

  it('marks the current snapshot stale after the configured threshold', async () => {
    vi.useFakeTimers();
    const valid = normalizeSnapshot(portfolioSnapshot);
    const loadSnapshot = vi.fn().mockResolvedValue(valid);
    const { result } = renderHook(() => useDashboardSnapshot({
      loadSnapshot,
      refreshMs: 0,
      staleAfterMs: 30_000,
    }));

    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(result.current.isStale).toBe(false);
    await act(async () => vi.advanceTimersByTimeAsync(29_999));
    expect(result.current.isStale).toBe(false);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(result.current.isStale).toBe(true);
  });

  it('aborts polling work during cleanup', async () => {
    let activeSignal;
    const loadSnapshot = vi.fn(({ signal }) => {
      activeSignal = signal;
      return new Promise(() => {});
    });
    const { unmount } = renderHook(() => useDashboardSnapshot({ loadSnapshot, refreshMs: 5_000 }));
    await waitFor(() => expect(loadSnapshot).toHaveBeenCalled());
    unmount();
    expect(activeSignal.aborted).toBe(true);
  });
});

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDashboardSnapshot } from './useDashboardSnapshot.js';
import { normalizeSnapshot } from '../services/api.js';
import { portfolioSnapshot } from '../data/mockPortfolio.js';

afterEach(() => vi.useRealTimers());

describe('useDashboardSnapshot', () => {
  it('refreshes on schedule and preserves the last snapshot after an API failure', async () => {
    vi.useFakeTimers();
    const valid = normalizeSnapshot(portfolioSnapshot);
    const loadSnapshot = vi.fn()
      .mockResolvedValueOnce(valid)
      .mockRejectedValueOnce(new Error('manager unavailable'));
    const { result } = renderHook(() => useDashboardSnapshot({ loadSnapshot, refreshMs: 5_000 }));

    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    expect(result.current.snapshot).toEqual(valid);
    expect(result.current.error).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(5_000);
      await Promise.resolve();
    });
    expect(loadSnapshot).toHaveBeenCalledTimes(2);
    expect(result.current.snapshot).toEqual(valid);
    expect(result.current.error.message).toBe('manager unavailable');
  });

  it('supports manual refresh and clears a previous error after recovery', async () => {
    const valid = normalizeSnapshot(portfolioSnapshot);
    const loadSnapshot = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(valid);
    const { result } = renderHook(() => useDashboardSnapshot({ loadSnapshot, refreshMs: 900_000 }));

    await waitFor(() => expect(result.current.error?.message).toBe('offline'));
    await act(async () => result.current.refresh());
    expect(result.current.snapshot).toEqual(valid);
    expect(result.current.error).toBeNull();
  });
});

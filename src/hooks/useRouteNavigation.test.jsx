import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRouteNavigation } from './useRouteNavigation.js';

const PUBLIC_ITEMS = [{ id: 'overview' }, { id: 'portfolio' }, { id: 'system' }];

describe('useRouteNavigation', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/portfolio');
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initializes from the URL and navigates only to available pages', () => {
    const { result } = renderHook(() => useRouteNavigation(PUBLIC_ITEMS));
    expect(result.current.activePage).toBe('portfolio');

    act(() => result.current.navigateToPage('system'));
    expect(result.current.activePage).toBe('system');
    expect(window.location.pathname).toBe('/system');
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });

    act(() => result.current.navigateToPage('ledger'));
    expect(result.current.activePage).toBe('system');
  });

  it('responds to browser navigation', () => {
    const { result } = renderHook(() => useRouteNavigation(PUBLIC_ITEMS));

    act(() => {
      window.history.pushState({}, '', '/overview');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(result.current.activePage).toBe('overview');
  });

  it('replaces a Manager-only URL when the route is unavailable', async () => {
    window.history.replaceState({}, '', '/ledger');
    const { result } = renderHook(() => useRouteNavigation(PUBLIC_ITEMS));

    expect(result.current.activePage).toBe('overview');
    await waitFor(() => expect(window.location.pathname).toBe('/overview'));
  });
});

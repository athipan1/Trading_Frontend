import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRouteNavigation } from './useRouteNavigation.js';

const PUBLIC_ITEMS = [{ id: 'overview' }, { id: 'portfolio' }, { id: 'risk' }, { id: 'system' }];

describe('useRouteNavigation', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/portfolio');
    document.documentElement.dataset.reducedMotion = 'false';
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => {
    delete document.documentElement.dataset.reducedMotion;
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

  it('uses the saved default page for root and canonicalizes its URL', async () => {
    window.history.replaceState({}, '', '/');
    const { result } = renderHook(() => useRouteNavigation(PUBLIC_ITEMS, { defaultPage: 'risk' }));

    expect(result.current.activePage).toBe('risk');
    await waitFor(() => expect(window.location.pathname).toBe('/risk'));
  });

  it('uses non-smooth scrolling when reduced motion is enabled', () => {
    document.documentElement.dataset.reducedMotion = 'true';
    const { result } = renderHook(() => useRouteNavigation(PUBLIC_ITEMS));

    act(() => result.current.navigateToPage('system'));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
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

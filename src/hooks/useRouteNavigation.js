import { useCallback, useEffect, useMemo, useState } from 'react';
import { pageFromPath, pathForPage } from '../routes/routeConfig.js';

export function useRouteNavigation(navigationItems, options = {}) {
  const defaultPage = options.defaultPage ?? 'overview';
  const [activePage, setActivePage] = useState(() => pageFromPath(window.location.pathname, defaultPage));
  const availablePages = useMemo(
    () => new Set(navigationItems.map((item) => item.id)),
    [navigationItems],
  );
  const resolvedActivePage = availablePages.has(activePage) ? activePage : 'overview';

  useEffect(() => {
    const syncFromLocation = () => {
      const nextPage = pageFromPath(window.location.pathname, defaultPage);
      setActivePage(nextPage);
      if (window.location.pathname === '/' && availablePages.has(nextPage)) {
        window.history.replaceState({}, '', pathForPage(nextPage));
      }
    };

    syncFromLocation();
    window.addEventListener('popstate', syncFromLocation);
    return () => window.removeEventListener('popstate', syncFromLocation);
  }, [availablePages, defaultPage]);

  useEffect(() => {
    if (activePage === resolvedActivePage) return;
    window.history.replaceState({}, '', pathForPage(resolvedActivePage));
  }, [activePage, resolvedActivePage]);

  const navigateToPage = useCallback((page) => {
    if (!availablePages.has(page)) return;
    setActivePage(page);
    window.history.pushState({}, '', pathForPage(page));
    const reducedMotion = document.documentElement.dataset.reducedMotion === 'true';
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [availablePages]);

  return { activePage: resolvedActivePage, navigateToPage };
}

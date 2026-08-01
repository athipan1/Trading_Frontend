import { useCallback, useEffect, useMemo, useState } from 'react';
import { pageFromPath, pathForPage } from '../routes/routeConfig.js';

export function useRouteNavigation(navigationItems) {
  const [activePage, setActivePage] = useState(() => pageFromPath(window.location.pathname));
  const availablePages = useMemo(
    () => new Set(navigationItems.map((item) => item.id)),
    [navigationItems],
  );
  const resolvedActivePage = availablePages.has(activePage) ? activePage : 'overview';

  useEffect(() => {
    const onPopState = () => setActivePage(pageFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (activePage === resolvedActivePage) return;
    window.history.replaceState({}, '', pathForPage(resolvedActivePage));
  }, [activePage, resolvedActivePage]);

  const navigateToPage = useCallback((page) => {
    if (!availablePages.has(page)) return;
    setActivePage(page);
    window.history.pushState({}, '', pathForPage(page));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [availablePages]);

  return { activePage: resolvedActivePage, navigateToPage };
}

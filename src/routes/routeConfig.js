export const PAGE_PATHS = Object.freeze({
  overview: '/overview',
  portfolio: '/portfolio',
  orders: '/orders',
  agents: '/agents',
  risk: '/risk',
  system: '/system',
  ledger: '/ledger',
  advisor: '/advisor',
  investment: '/investment',
});

export const MANAGER_CONTROL_PAGES = Object.freeze(['ledger', 'advisor', 'investment']);

export function pageFromPath(pathname) {
  const normalized = String(pathname || '/').replace(/\/+$/, '') || '/';
  if (normalized === '/') return 'overview';
  return Object.entries(PAGE_PATHS).find(([, path]) => path === normalized)?.[0] || 'overview';
}

export function pathForPage(page) {
  return PAGE_PATHS[page] ?? PAGE_PATHS.overview;
}

export function isManagerControlPage(page) {
  return MANAGER_CONTROL_PAGES.includes(page);
}

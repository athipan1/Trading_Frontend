import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDashboardRuntimeConfig, resetDashboardRuntimeConfigForTests } from './runtimeConfig.js';

describe('runtime dashboard configuration', () => {
  afterEach(() => {
    resetDashboardRuntimeConfigForTests();
    vi.unstubAllEnvs();
  });

  it('resolves and caches a Manager-only API configuration', () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'manager-api');
    vi.stubEnv('VITE_MANAGER_API_URL', '/api/');
    vi.stubEnv('VITE_REFRESH_INTERVAL_MS', '45000');

    const first = getDashboardRuntimeConfig();
    const second = getDashboardRuntimeConfig();

    expect(first).toEqual(expect.objectContaining({
      dataSource: 'manager-api',
      managerApiUrl: '/api',
      refreshIntervalMs: 45000,
    }));
    expect(second).toBe(first);
  });
});

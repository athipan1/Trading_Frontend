import { describe, expect, it } from 'vitest';
import { DashboardConfigError, resolveDashboardConfig } from './dashboardConfig.js';

const publicUrl = 'https://raw.githubusercontent.com/athipan1/Manager_Agent/dashboard-data/docs/dashboard/latest-dashboard-snapshot.json';

describe('resolveDashboardConfig', () => {
  it('defaults local development to mock mode', () => {
    expect(resolveDashboardConfig({}, { isProduction: false }).dataSource).toBe('mock');
  });

  it('defaults production to public-snapshot and fails closed without its URL', () => {
    expect(() => resolveDashboardConfig({}, { isProduction: true })).toThrow(DashboardConfigError);
    expect(() => resolveDashboardConfig({}, { isProduction: true })).toThrow('VITE_DASHBOARD_SNAPSHOT_URL is required');
  });

  it('accepts a secure public snapshot in production', () => {
    const config = resolveDashboardConfig(
      { VITE_DASHBOARD_SNAPSHOT_URL: publicUrl, VITE_REFRESH_INTERVAL_MS: '60000' },
      { isProduction: true },
    );
    expect(config.dataSource).toBe('public-snapshot');
    expect(config.snapshotUrl).toBe(publicUrl);
    expect(config.refreshIntervalMs).toBe(60_000);
  });

  it('requires a snapshot URL in explicit public-snapshot mode', () => {
    expect(() => resolveDashboardConfig({ VITE_DATA_SOURCE: 'public-snapshot' })).toThrow(
      'VITE_DASHBOARD_SNAPSHOT_URL is required',
    );
  });

  it('keeps same-origin Manager API available for optional control deployments', () => {
    const config = resolveDashboardConfig(
      { VITE_DATA_SOURCE: 'manager-api', VITE_MANAGER_API_URL: '/api', VITE_REFRESH_INTERVAL_MS: '60000' },
      { isProduction: true },
    );
    expect(config.managerApiUrl).toBe('/api');
    expect(config.refreshIntervalMs).toBe(60_000);
  });

  it('rejects credentials, query tokens, insecure URLs and unsupported modes', () => {
    expect(() => resolveDashboardConfig(
      { VITE_DATA_SOURCE: 'public-snapshot', VITE_DASHBOARD_SNAPSHOT_URL: 'http://example.com/snapshot.json' },
      { isProduction: true },
    )).toThrow('must use HTTPS');
    expect(() => resolveDashboardConfig(
      { VITE_DATA_SOURCE: 'public-snapshot', VITE_DASHBOARD_SNAPSHOT_URL: `${publicUrl}?token=secret` },
      { isProduction: true },
    )).toThrow('must not contain credentials');
    expect(() => resolveDashboardConfig({ VITE_DATA_SOURCE: 'automatic' })).toThrow('must be one of');
  });

  it('rejects refresh intervals that would overload or effectively disable polling', () => {
    expect(() => resolveDashboardConfig({ VITE_DATA_SOURCE: 'mock', VITE_REFRESH_INTERVAL_MS: '100' })).toThrow(
      'VITE_REFRESH_INTERVAL_MS',
    );
  });
});

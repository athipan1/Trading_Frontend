import { describe, expect, it } from 'vitest';
import { DashboardConfigError, resolveDashboardConfig } from './dashboardConfig.js';

describe('resolveDashboardConfig', () => {
  it('defaults local development to mock mode', () => {
    expect(resolveDashboardConfig({}, { isProduction: false }).dataSource).toBe('mock');
  });

  it('fails closed when production manager-api has no URL', () => {
    expect(() => resolveDashboardConfig({}, { isProduction: true })).toThrow(DashboardConfigError);
    expect(() => resolveDashboardConfig({}, { isProduction: true })).toThrow('VITE_MANAGER_API_URL is required');
  });

  it('requires a snapshot URL in public-snapshot mode', () => {
    expect(() => resolveDashboardConfig({ VITE_DATA_SOURCE: 'public-snapshot' })).toThrow(
      'VITE_DASHBOARD_SNAPSHOT_URL is required',
    );
  });

  it('accepts a same-origin Manager proxy for production Docker', () => {
    const config = resolveDashboardConfig(
      { VITE_DATA_SOURCE: 'manager-api', VITE_MANAGER_API_URL: '/api', VITE_REFRESH_INTERVAL_MS: '60000' },
      { isProduction: true },
    );
    expect(config.managerApiUrl).toBe('/api');
    expect(config.refreshIntervalMs).toBe(60_000);
  });

  it('rejects insecure remote production URLs and unsupported modes', () => {
    expect(() => resolveDashboardConfig(
      { VITE_DATA_SOURCE: 'manager-api', VITE_MANAGER_API_URL: 'http://manager.example.com' },
      { isProduction: true },
    )).toThrow('must use HTTPS');
    expect(() => resolveDashboardConfig({ VITE_DATA_SOURCE: 'automatic' })).toThrow('must be one of');
  });

  it('rejects refresh intervals that would overload or effectively disable polling', () => {
    expect(() => resolveDashboardConfig({ VITE_DATA_SOURCE: 'mock', VITE_REFRESH_INTERVAL_MS: '100' })).toThrow(
      'VITE_REFRESH_INTERVAL_MS',
    );
  });
});

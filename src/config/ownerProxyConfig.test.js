import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveDashboardConfig } from './dashboardConfig.js';

const snapshotUrl =
  'https://raw.githubusercontent.com/athipan1/Manager_Agent/dashboard-data/docs/dashboard/latest-dashboard-snapshot.json';
const managerOrigin = 'https://manageragent-production.up.railway.app';

function readVercelConfig() {
  return JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'));
}

describe('Owner Secure View production proxy', () => {
  it('defaults masked production snapshots to the same-origin owner proxy', () => {
    const config = resolveDashboardConfig(
      {
        VITE_DATA_SOURCE: 'public-snapshot',
        VITE_DASHBOARD_SNAPSHOT_URL: snapshotUrl,
        VITE_MANAGER_API_URL: '',
      },
      { isProduction: true },
    );

    expect(config.managerApiUrl).toBe('/manager-api');
  });

  it('proxies only the owner snapshot route before the SPA fallback', () => {
    const config = readVercelConfig();
    const ownerRewrite = config.rewrites[0];
    const spaFallback = config.rewrites[1];

    expect(ownerRewrite).toEqual({
      source: '/manager-api/web-control/owner-snapshot',
      destination: `${managerOrigin}/web-control/owner-snapshot`,
    });
    expect(spaFallback).toEqual({ source: '/(.*)', destination: '/index.html' });
  });
});

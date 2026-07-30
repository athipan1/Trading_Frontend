import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const snapshotUrl =
  'https://raw.githubusercontent.com/athipan1/Manager_Agent/dashboard-data/docs/dashboard/latest-dashboard-snapshot.json';

function readVercelConfig() {
  return JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
}

describe('Vercel production build configuration', () => {
  it('forces the public snapshot source even when stale Vercel env values exist', () => {
    const config = readVercelConfig();

    expect(config.framework).toBe('vite');
    expect(config.outputDirectory).toBe('dist');
    expect(config.buildCommand).toContain('VITE_DATA_SOURCE=public-snapshot');
    expect(config.buildCommand).toContain('VITE_MANAGER_API_URL= ');
    expect(config.buildCommand).toContain(`VITE_DASHBOARD_SNAPSHOT_URL=${snapshotUrl}`);
    expect(config.buildCommand).toContain('VITE_REFRESH_INTERVAL_MS=60000');
    expect(config.buildCommand).not.toContain('VITE_DATA_SOURCE=manager-api');
  });

  it('allows the browser to fetch the Manager_Agent snapshot host', () => {
    const config = readVercelConfig();
    const rootHeaders = config.headers.find((entry) => entry.source === '/(.*)');
    const csp = rootHeaders?.headers.find((header) => header.key === 'Content-Security-Policy')?.value;

    expect(csp).toContain("connect-src 'self' https://raw.githubusercontent.com");
  });
});

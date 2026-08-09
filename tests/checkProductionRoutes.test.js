// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  PRODUCTION_ROUTES,
  PRODUCTION_VIEWPORTS,
  approvedProductionUrl,
  evaluateRuntimeHealth,
  hasHorizontalOverflow,
  isMonitoredRequestUrl,
} from '../scripts/check-production-routes.mjs';

describe('Production route smoke helpers', () => {
  it('covers every public production route at mobile and desktop widths', () => {
    expect(PRODUCTION_ROUTES.map((route) => route.path)).toEqual([
      '/overview',
      '/portfolio',
      '/orders',
      '/agents',
      '/risk',
      '/backtest',
      '/system',
      '/settings',
    ]);
    expect(PRODUCTION_VIEWPORTS).toEqual([
      { name: 'mobile-320', width: 320, height: 900 },
      { name: 'desktop-1280', width: 1280, height: 900 },
    ]);
  });

  it('allows only the approved HTTPS production host', () => {
    expect(approvedProductionUrl('https://trading-frontend-wheat-pi.vercel.app/risk?x=1').toString())
      .toBe('https://trading-frontend-wheat-pi.vercel.app/');
    expect(() => approvedProductionUrl('http://trading-frontend-wheat-pi.vercel.app/')).toThrow('HTTPS');
    expect(() => approvedProductionUrl('https://example.com/')).toThrow('trading-frontend-wheat-pi.vercel.app');
  });

  it('detects horizontal overflow with a one-pixel tolerance', () => {
    expect(hasHorizontalOverflow({ viewportWidth: 320, documentWidth: 320, bodyWidth: 320 })).toBe(false);
    expect(hasHorizontalOverflow({ viewportWidth: 320, documentWidth: 321, bodyWidth: 320 })).toBe(false);
    expect(hasHorizontalOverflow({ viewportWidth: 320, documentWidth: 322, bodyWidth: 320 })).toBe(true);
  });

  it('monitors production and Manager snapshot request failures only', () => {
    const origin = 'https://trading-frontend-wheat-pi.vercel.app';
    expect(isMonitoredRequestUrl(`${origin}/assets/app.js`, origin)).toBe(true);
    expect(isMonitoredRequestUrl(
      'https://raw.githubusercontent.com/athipan1/Manager_Agent/dashboard-data/docs/dashboard/latest-dashboard-snapshot.json?cache=1',
      origin,
    )).toBe(true);
    expect(isMonitoredRequestUrl('https://example.com/telemetry', origin)).toBe(false);
    expect(isMonitoredRequestUrl('not a url', origin)).toBe(false);
  });

  it('fails closed on console, page, or monitored request runtime errors', () => {
    expect(evaluateRuntimeHealth()).toEqual({
      consoleErrors: [],
      pageErrors: [],
      requestFailures: [],
      total: 0,
    });
    expect(() => evaluateRuntimeHealth({ consoleErrors: ['React runtime error'] })).toThrow('console.error');
    expect(() => evaluateRuntimeHealth({ pageErrors: ['Uncaught TypeError'] })).toThrow('pageerror');
    expect(() => evaluateRuntimeHealth({ requestFailures: ['GET /assets/app.js (net::ERR_FAILED)'] })).toThrow('requestfailed');
  });
});

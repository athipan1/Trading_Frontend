// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  PRODUCTION_INTERACTION_CASES,
  interactionRouteUrl,
  isSafePreferenceRecord,
} from '../scripts/check-production-interactions.mjs';

describe('Production interaction smoke helpers', () => {
  it('keeps the interaction inventory explicit and read-only', () => {
    expect(PRODUCTION_INTERACTION_CASES).toEqual([
      'desktop-navigation-history',
      'manual-refresh',
      'settings-persistence-reset',
      'mobile-more-navigation',
    ]);
  });

  it('builds a same-origin interaction URL without carrying arbitrary query data', () => {
    const target = new URL('https://trading-frontend-wheat-pi.vercel.app/');
    const result = interactionRouteUrl(target, '/risk', 'mobile-more-navigation');
    expect(result.origin).toBe(target.origin);
    expect(result.pathname).toBe('/risk');
    expect(result.searchParams.get('interaction-smoke')).toContain('mobile-more-navigation');
  });

  it('rejects preference records that could contain credentials', () => {
    expect(isSafePreferenceRecord({ theme: 'dark', refreshInterval: 0, defaultPage: 'risk' })).toBe(true);
    expect(isSafePreferenceRecord({ operatorToken: 'secret-value' })).toBe(false);
    expect(isSafePreferenceRecord({ api_key: 'secret-value' })).toBe(false);
    expect(isSafePreferenceRecord({ password: 'secret-value' })).toBe(false);
    expect(isSafePreferenceRecord(null)).toBe(false);
  });
});

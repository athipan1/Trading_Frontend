import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  applyPreferences,
  applyPrivacyPreferences,
  clearPreferences,
  loadPreferences,
  sanitizePreferences,
  savePreferences,
} from './preferences.js';

describe('settings preferences', () => {
  beforeEach(() => window.localStorage.clear());

  it('falls back safely for malformed or unsupported values', () => {
    expect(sanitizePreferences({ theme: 'neon', refreshInterval: 1, defaultPage: 'admin' })).toEqual(DEFAULT_PREFERENCES);
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, '{broken');
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('stores only allowlisted presentation preferences', () => {
    const saved = savePreferences({
      theme: 'dark',
      density: 'compact',
      reducedMotion: true,
      refreshInterval: 10,
      refreshOnFocus: false,
      staleWarningSeconds: 180,
      maskAccountValues: true,
      maskPositionSizes: true,
      defaultPage: 'risk',
      operatorToken: 'must-not-persist',
      apiKey: 'must-not-persist',
    });

    expect(loadPreferences()).toEqual(saved);
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    expect(raw).not.toContain('must-not-persist');
    expect(raw).not.toContain('operatorToken');
    expect(raw).not.toContain('apiKey');
  });

  it('applies display preferences and resets storage', () => {
    applyPreferences({ ...DEFAULT_PREFERENCES, theme: 'dark', density: 'compact', reducedMotion: true });
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.density).toBe('compact');
    expect(document.documentElement.dataset.reducedMotion).toBe('true');

    savePreferences({ ...DEFAULT_PREFERENCES, theme: 'light' });
    expect(clearPreferences()).toEqual(DEFAULT_PREFERENCES);
    expect(window.localStorage.getItem(PREFERENCES_STORAGE_KEY)).toBeNull();
  });

  it('adds presentation-only privacy flags without mutating the source snapshot', () => {
    const snapshot = {
      account: { cash: 1000, valuesMasked: false },
      positions: [{ symbol: 'ACGL', quantity: 4, marketValue: 500, valuesMasked: false }],
    };

    const masked = applyPrivacyPreferences(snapshot, {
      ...DEFAULT_PREFERENCES,
      maskAccountValues: true,
      maskPositionSizes: true,
    });

    expect(masked).not.toBe(snapshot);
    expect(masked.account.valuesMasked).toBe(true);
    expect(masked.positions[0].valuesMasked).toBe(true);
    expect(masked.positions[0].quantityMasked).toBe(true);
    expect(masked.privacy).toEqual({ valuesMasked: true, positionSizesMasked: true });
    expect(snapshot.account.valuesMasked).toBe(false);
    expect(snapshot.positions[0].quantityMasked).toBeUndefined();
  });

  it('reuses the original snapshot when no local privacy mask is enabled', () => {
    const snapshot = { account: { valuesMasked: false }, positions: [] };
    expect(applyPrivacyPreferences(snapshot, DEFAULT_PREFERENCES)).toBe(snapshot);
    expect(applyPrivacyPreferences(null, DEFAULT_PREFERENCES)).toBeNull();
  });
});

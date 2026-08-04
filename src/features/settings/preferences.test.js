import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  applyPreferences,
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
});

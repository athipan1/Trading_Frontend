import { afterEach, describe, expect, it, vi } from 'vitest';
import { getInitialLanguage, translations } from './i18n.js';

describe('dashboard language selection', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it.each(['th', 'en'])('prefers the saved %s language', (language) => {
    window.localStorage.setItem('trading-dashboard-language', language);

    expect(getInitialLanguage()).toBe(language);
  });

  it('uses Thai for a Thai browser when no supported choice is saved', () => {
    window.localStorage.setItem('trading-dashboard-language', 'unsupported');
    vi.stubGlobal('navigator', { language: 'th-TH' });

    expect(getInitialLanguage()).toBe('th');
  });

  it('falls back to English for other or unavailable browser languages', () => {
    vi.stubGlobal('navigator', { language: undefined });

    expect(getInitialLanguage()).toBe('en');
    expect(translations.en.navOverview).toBeTruthy();
    expect(translations.th.navOverview).toBeTruthy();
  });

  it('keeps English and Thai route copy structurally complete', () => {
    expect(Object.keys(translations.en).sort()).toEqual(Object.keys(translations.th).sort());
    expect(Object.keys(translations.en.orderStatusGroups).sort()).toEqual(
      Object.keys(translations.th.orderStatusGroups).sort(),
    );
    expect(Object.keys(translations.en.orderTimelineEvents).sort()).toEqual(
      Object.keys(translations.th.orderTimelineEvents).sort(),
    );
    expect(Object.keys(translations.en.agentSummaryLabels).sort()).toEqual(
      Object.keys(translations.th.agentSummaryLabels).sort(),
    );
    expect(Object.keys(translations.en.agentRoles).sort()).toEqual(
      Object.keys(translations.th.agentRoles).sort(),
    );
    expect(Object.keys(translations.en.agentFilterLabels).sort()).toEqual(
      Object.keys(translations.th.agentFilterLabels).sort(),
    );
    expect(Object.keys(translations.en.agentHealthGroups).sort()).toEqual(
      Object.keys(translations.th.agentHealthGroups).sort(),
    );
    expect(Object.keys(translations.en.riskLevelLabels).sort()).toEqual(
      Object.keys(translations.th.riskLevelLabels).sort(),
    );
    expect(Object.keys(translations.en.riskSources).sort()).toEqual(
      Object.keys(translations.th.riskSources).sort(),
    );
    expect(Object.keys(translations.en.emergencyHaltStates).sort()).toEqual(
      Object.keys(translations.th.emergencyHaltStates).sort(),
    );
    expect(Object.keys(translations.en.backtestStrategies).sort()).toEqual(
      Object.keys(translations.th.backtestStrategies).sort(),
    );
    expect(Object.keys(translations.en.backtestValidationErrors).sort()).toEqual(
      Object.keys(translations.th.backtestValidationErrors).sort(),
    );
  });
});

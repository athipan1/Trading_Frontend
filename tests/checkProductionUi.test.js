import { describe, expect, it } from 'vitest';
import { evaluateUiStatus } from '../scripts/check-production-ui.mjs';

describe('Production smoke UI classification', () => {
  it('accepts a stale banner as degraded upstream data', () => {
    expect(
      evaluateUiStatus({
        errorBannerTexts: [],
        staleBannerCount: 1,
      }),
    ).toEqual({
      staleDataVisible: true,
      warnings: [
        'Production UI is healthy but displays a stale Manager snapshot warning.',
      ],
    });
  });

  it('accepts a healthy page without warnings', () => {
    expect(
      evaluateUiStatus({
        errorBannerTexts: [],
        staleBannerCount: 0,
      }),
    ).toEqual({ staleDataVisible: false, warnings: [] });
  });

  it('fails when the application reports a snapshot load error', () => {
    expect(() =>
      evaluateUiStatus({
        errorBannerTexts: ['โหลด Snapshot ไม่สำเร็จ'],
        staleBannerCount: 1,
      }),
    ).toThrow('data-load error');
  });
});

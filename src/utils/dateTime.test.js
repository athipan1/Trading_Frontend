import { describe, expect, it } from 'vitest';
import { formatBangkokDateTime } from './dateTime.js';

describe('Bangkok dashboard timestamps', () => {
  it('formats valid timestamps in the selected locale', () => {
    expect(formatBangkokDateTime('2026-08-01T00:00:00Z', 'en', 'never')).toContain('2026');
    expect(formatBangkokDateTime('2026-08-01T00:00:00Z', 'th', 'ไม่เคย')).toContain('2569');
  });

  it('returns a safe fallback for missing or invalid values', () => {
    expect(formatBangkokDateTime('', 'en', 'never')).toBe('never');
    expect(formatBangkokDateTime('invalid', 'en', 'never')).toBe('never');
  });
});

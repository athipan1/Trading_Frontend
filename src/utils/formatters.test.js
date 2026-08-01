import { describe, expect, it } from 'vitest';
import { formatCurrency, formatNumber, formatPercent, pnlClassName } from './formatters.js';

describe('financial formatters', () => {
  it('formats currency, numbers, percentages, and empty values consistently', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
    expect(formatCurrency(null)).toBe('$0.00');
    expect(formatNumber(12.345, 1)).toBe('12.3');
    expect(formatPercent(0.125)).toBe('12.50%');
  });

  it.each([
    [10, 'positive'],
    [-0.1, 'negative'],
    [0, 'neutral'],
    [undefined, 'neutral'],
  ])('maps %s to the %s P/L class', (value, expected) => {
    expect(pnlClassName(value)).toBe(expected);
  });
});

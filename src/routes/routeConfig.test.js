import { describe, expect, it } from 'vitest';
import { isManagerControlPage, pageFromPath, pathForPage } from './routeConfig.js';

describe('route configuration', () => {
  it.each([
    ['/', 'overview'],
    ['/overview/', 'overview'],
    ['/portfolio', 'portfolio'],
    ['/orders', 'orders'],
    ['/agents', 'agents'],
    ['/risk', 'risk'],
    ['/backtest', 'backtest'],
    ['/system', 'system'],
    ['/ledger', 'ledger'],
    ['/unknown', 'overview'],
    ['', 'overview'],
  ])('maps %s to %s', (path, page) => {
    expect(pageFromPath(path)).toBe(page);
  });

  it('returns only registered paths', () => {
    expect(pathForPage('portfolio')).toBe('/portfolio');
    expect(pathForPage('orders')).toBe('/orders');
    expect(pathForPage('agents')).toBe('/agents');
    expect(pathForPage('risk')).toBe('/risk');
    expect(pathForPage('backtest')).toBe('/backtest');
    expect(pathForPage('missing')).toBe('/overview');
  });

  it('identifies routes that require Manager control mode', () => {
    expect(isManagerControlPage('ledger')).toBe(true);
    expect(isManagerControlPage('advisor')).toBe(true);
    expect(isManagerControlPage('investment')).toBe(true);
    expect(isManagerControlPage('overview')).toBe(false);
    expect(isManagerControlPage('orders')).toBe(false);
    expect(isManagerControlPage('agents')).toBe(false);
    expect(isManagerControlPage('risk')).toBe(false);
    expect(isManagerControlPage('backtest')).toBe(false);
  });
});

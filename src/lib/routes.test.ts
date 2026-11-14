import { describe, expect, it } from 'vitest';
import { hrefFor, ROUTES, routeFromHash } from './routes';

describe('routeFromHash', () => {
  it('maps each screen hash to its route', () => {
    expect(routeFromHash('#/log')).toBe('log');
    expect(routeFromHash('#/history')).toBe('history');
    expect(routeFromHash('#/metrics')).toBe('metrics');
    expect(routeFromHash('#/settings')).toBe('settings');
  });

  it('accepts a hash without the slash', () => {
    expect(routeFromHash('#history')).toBe('history');
  });

  it('opens Log for an empty, root or unknown hash', () => {
    expect(routeFromHash('')).toBe('log');
    expect(routeFromHash('#')).toBe('log');
    expect(routeFromHash('#/')).toBe('log');
    expect(routeFromHash('#/nope')).toBe('log');
  });

  it('does not match on a prefix or different case', () => {
    expect(routeFromHash('#/historyx')).toBe('log');
    expect(routeFromHash('#/History')).toBe('log');
  });

  it('round-trips every route through hrefFor', () => {
    for (const route of ROUTES) expect(routeFromHash(hrefFor(route))).toBe(route);
  });
});

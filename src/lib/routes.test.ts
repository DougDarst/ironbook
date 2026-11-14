import { describe, expect, it } from 'vitest';
import { hrefFor, hrefForWorkout, ROUTES, routeFromHash, workoutIdFromHash } from './routes';

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

describe('workout routes', () => {
  const id = 'abc123def456ghi';

  it('opens a workout under the Log tab', () => {
    expect(routeFromHash(`#/workout/${id}`)).toBe('log');
    expect(workoutIdFromHash(`#/workout/${id}`)).toBe(id);
  });

  it('round-trips through hrefForWorkout', () => {
    expect(workoutIdFromHash(hrefForWorkout(id))).toBe(id);
  });

  it('ignores malformed ids', () => {
    expect(workoutIdFromHash('#/workout/short')).toBeNull();
    expect(workoutIdFromHash('#/workout/ABC123DEF456GHI')).toBeNull();
    expect(workoutIdFromHash(`#/workout/${id}/x`)).toBeNull();
    expect(workoutIdFromHash('#/history')).toBeNull();
  });
});

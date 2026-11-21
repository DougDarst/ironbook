/** The app's screens and their hash URLs. Pure functions; see router.svelte.ts. */
export type Route = 'log' | 'history' | 'settings';

export const ROUTES: readonly Route[] = ['log', 'history', 'settings'];

/** A PocketBase record id: 15 lowercase letters and digits. */
const WORKOUT = /^#\/?workout\/([a-z0-9]{15})$/;

/**
 * Maps a location hash (e.g. "#/history") to a route. A workout
 * ("#/workout/<id>") belongs to Log. The old Metrics screen ("#/metrics",
 * removed 2026-11-20) opens History. An empty or unknown hash opens Log,
 * the default screen.
 */
export function routeFromHash(hash: string): Route {
  if (WORKOUT.test(hash)) return 'log';
  const name = hash.replace(/^#\/?/, '');
  if (name === 'metrics') return 'history';
  return (ROUTES as readonly string[]).includes(name) ? (name as Route) : 'log';
}

/** The workout id in a "#/workout/<id>" hash, or null. */
export function workoutIdFromHash(hash: string): string | null {
  return WORKOUT.exec(hash)?.[1] ?? null;
}

export function hrefFor(route: Route): string {
  return `#/${route}`;
}

export function hrefForWorkout(id: string): string {
  return `#/workout/${id}`;
}

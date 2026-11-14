/** The app's screens and their hash URLs. Pure functions; see router.svelte.ts. */
export type Route = 'log' | 'history' | 'metrics' | 'settings';

export const ROUTES: readonly Route[] = ['log', 'history', 'metrics', 'settings'];

/**
 * Maps a location hash (e.g. "#/history") to a route. An empty or unknown
 * hash opens Log, the default screen.
 */
export function routeFromHash(hash: string): Route {
  const name = hash.replace(/^#\/?/, '');
  return (ROUTES as readonly string[]).includes(name) ? (name as Route) : 'log';
}

export function hrefFor(route: Route): string {
  return `#/${route}`;
}

/**
 * Minimal hash router. Hash URLs work with any static host and keep the
 * browser's back button and reloads working.
 */
export type Route = 'log' | 'history' | 'metrics' | 'settings';

const ROUTES: readonly Route[] = ['log', 'history', 'metrics', 'settings'];

/** Maps a location hash (e.g. "#/history") to a route; anything else is Log. */
export function routeFromHash(hash: string): Route {
  const name = hash.replace(/^#\/?/, '');
  return (ROUTES as readonly string[]).includes(name) ? (name as Route) : 'log';
}

export function hrefFor(route: Route): string {
  return `#/${route}`;
}

class Router {
  route = $state<Route>(routeFromHash(window.location.hash));

  constructor() {
    window.addEventListener('hashchange', () => {
      this.route = routeFromHash(window.location.hash);
    });
  }
}

export const router = new Router();

import { routeFromHash, type Route } from '../routes';

export { hrefFor, type Route } from '../routes';

/**
 * Minimal hash router. Hash URLs work with any static host and keep the
 * browser's back button and reloads working.
 */
class Router {
  route = $state<Route>(routeFromHash(window.location.hash));

  constructor() {
    window.addEventListener('hashchange', () => {
      this.route = routeFromHash(window.location.hash);
    });
  }
}

export const router = new Router();

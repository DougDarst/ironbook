import { routeFromHash, workoutIdFromHash, type Route } from '../routes';

export { hrefFor, hrefForWorkout, type Route } from '../routes';

/**
 * Minimal hash router. Hash URLs work with any static host and keep the
 * browser's back button and reloads working.
 */
class Router {
  route = $state<Route>(routeFromHash(window.location.hash));
  /** The open workout ("#/workout/<id>"), or null. */
  workoutId = $state<string | null>(workoutIdFromHash(window.location.hash));

  constructor() {
    window.addEventListener('hashchange', () => {
      this.route = routeFromHash(window.location.hash);
      this.workoutId = workoutIdFromHash(window.location.hash);
    });
  }

  go(hash: string): void {
    window.location.hash = hash;
  }
}

export const router = new Router();

import PocketBase from 'pocketbase';

/**
 * The PocketBase client. A built app is served by PocketBase itself, so it
 * always talks to the same origin. Only the Vite dev server (`npm run dev`)
 * uses VITE_PB_URL from .env; it's ignored in builds, so a local .env can
 * never point a deployed app somewhere else.
 */
export const pb = new PocketBase(
  import.meta.env.DEV && import.meta.env.VITE_PB_URL ? import.meta.env.VITE_PB_URL : window.location.origin,
);

// The SDK cancels duplicate in-flight requests by default; we never want that.
pb.autoCancellation(false);

/// <reference path="../pb_data/types.d.ts" />

/**
 * Turns on PocketBase's built-in rate limiting (off by default), mainly to
 * slow down password guessing: its default "*:auth" rule allows 2 sign-in
 * attempts per 3 seconds per IP. Limits are per visitor IP, so the server
 * must trust Caddy's X-Forwarded-For header (README, server setup step 7);
 * otherwise every visitor shares one limit.
 */
migrate(
  (app) => {
    const settings = app.settings();
    settings.rateLimits.enabled = true;
    app.save(settings);
  },
  (app) => {
    const settings = app.settings();
    settings.rateLimits.enabled = false;
    app.save(settings);
  },
);

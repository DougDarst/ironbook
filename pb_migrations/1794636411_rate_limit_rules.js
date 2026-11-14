/// <reference path="../pb_data/types.d.ts" />

/**
 * Explicit rate-limit rules (per visitor IP), replacing PocketBase's
 * defaults. The default "*:create" limit (20 per 5 s) also counts each
 * create inside a batch request, so starting a workout or importing a CSV
 * would hit it. Signed-in users get a much higher create limit; sign-in
 * attempts stay tight to slow password guessing.
 *
 * Tests: tests/integration/limits.test.ts runs against a server with these
 * exact limits (the other test servers relax them).
 */
const RULES = [
  { label: '*:auth', audience: '', duration: 3, maxRequests: 2 },
  { label: '*:create', audience: '@guest', duration: 5, maxRequests: 20 },
  { label: '*:create', audience: '@auth', duration: 5, maxRequests: 500 },
  { label: '/api/batch', audience: '', duration: 1, maxRequests: 3 },
  { label: '/api/', audience: '', duration: 10, maxRequests: 300 },
];

const DEFAULT_RULES = [
  { label: '*:auth', audience: '', duration: 3, maxRequests: 2 },
  { label: '*:create', audience: '', duration: 5, maxRequests: 20 },
  { label: '/api/batch', audience: '', duration: 1, maxRequests: 3 },
  { label: '/api/', audience: '', duration: 10, maxRequests: 300 },
];

migrate(
  (app) => {
    const settings = app.settings();
    settings.rateLimits.enabled = true;
    settings.rateLimits.rules = RULES;
    app.save(settings);
  },
  (app) => {
    const settings = app.settings();
    settings.rateLimits.rules = DEFAULT_RULES;
    app.save(settings);
  },
);

# TODO

Deferred work and provisional decisions. See [spec.md](spec.md) for the
source of truth.

## Provisional (revisit after using the app)
- **Only done sets count.** Volume, change, PRs, charts, monthly totals and
  export use done sets only. Revisit after real use.

## Open decisions (to propose at the relevant story)
- Demo sample data and reset schedule (Story 23).
- Chart library or hand-built SVG (Story 17).
- iPhone History card mockup (Story 15).

## Testing gaps (review of 2026-11-13; all approved)
Found in a review after Story 10. Items 1–3 are being fixed first; the
rest are folded into the stories they touch or kept here.

**Now**
1. ~~Test under production rate limits.~~ Done (story/limits): a strict
   integration server; create limit raised for signed-in users.
2. ~~Test the deploy script's upload step.~~ Done (story/deploy-upload-test).
3. ~~At most 20 exercises per workout.~~ Done (story/limits).

**Fold into upcoming stories**
4. Error-state tests (failed network requests) for each screen.
5. Run date-sensitive E2E tests in a far-off time zone, plus near local
   midnight.
6. Migrations: test up → down → up now; before go-live, migrate a copy of
   realistic data.
7. Two-device tests: realtime edits and isolation done (Stories 11–12);
   the Start race (another device created today's workout) still to do.
8. Vitest coverage report for `src/lib/` with a threshold.
9. Manual checklist on a real iPhone per screen story: see
   `docs/manual-checks.md` (started with Stories 10–12).

**Later**
10. Visual regression screenshots (CI only) once screens settle.
11. Property-based tests for the calc module.
12. E2E: an exercise name containing HTML shows as plain text.
13. Report tests that only passed on retry in CI.
14. Go-live checklist: restore a backup into a scratch instance.
15. Keep watching for the unexplained PocketBase crash (Story 5); the
    integration harness prints its output if it recurs.

## Go-live checklist (deferred until the end of development)
Development happens locally; nothing is deployed until the app is ready.
These are the steps that need the tech lead or the server, in order. Each
README reference is the detailed how-to. Stories that add more server steps
(e.g. admin UI settings) add them here.

**Server setup** (README › Deployment › One-time server setup)
- [ ] Point a DNS record for the app's subdomain at the server.
- [ ] Steps 1–5: create `/opt/ironbook`, download the pinned Linux
      PocketBase, install and enable (don't start) the `ironbook` unit,
      create the superuser, add the Caddy block and reload Caddy.
- [ ] On your machine: fill in the `DEPLOY_` settings in `.env`.

**First deploy** (README › Deployment › Deploying updates)
- [ ] From an up-to-date `main`: `npm run deploy -- --dry-run`, then
      `npm run deploy`. Run it in your own terminal: the restart uses
      `sudo` over SSH.
- [ ] Step 7 in the admin UI (`/_/`): set the Application URL, and add
      `X-Forwarded-For` as the user IP proxy header (rightmost IP).
- [ ] Check: the site loads over HTTPS and shows the version from `main`.
      *(Story 4's "done when".)*

**Accounts** (README › Accounts)
- [ ] In the admin UI, create your own account in the **users** collection
      (email + a strong password), and accounts for anyone you invite.
- [ ] Optional: create a demo account (tick **demo**) to hand out.
- [ ] Check: you can sign in; a wrong password is refused.
- [ ] Check: rate limiting is on (Settings › Application › Rate limits;
      turned on by a migration) and the proxy header from step 7 is set, so
      limits apply per visitor.

**Data and launch**
- [ ] Set up scheduled backups (Settings › Backups; the server clock is
      usually UTC).
- [ ] Export the Google Sheet to CSV and import it in Settings on the live
      site. *(Story 22.)*
- [ ] Spot-check volumes against the sheet, then retire the sheet.
- [ ] Bump `VERSION` to 1.0 in `src/lib/config.ts`, merge, and deploy.

## Later (v2 and beyond)
- Integrations: Strava, Apple Health.
- Heaviest-weight PR.
- A rename-exercise screen (the data model already applies a rename
  everywhere).
- Highlighting of individual weight/rep cells in History (e.g. more reps
  than last time).
- More metrics.

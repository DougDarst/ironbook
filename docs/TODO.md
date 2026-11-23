# TODO

Deferred work and provisional decisions. See [spec.md](spec.md) for the
source of truth.

## Provisional (revisit after using the app)
- **Only done sets count.** Volume, change, PRs, charts, monthly totals and
  export use done sets only. Revisit after real use.

## Open decisions (to propose at the relevant story)
- None.

## Testing gaps (review of 2026-11-13; all approved)
Found in a review after Story 10. Items 1–3 are being fixed first; the
rest are folded into the stories they touch or kept here.

**Now**
1. ~~Test under production rate limits.~~ Done (story/limits): a strict
   integration server; create limit raised for signed-in users.
2. ~~Test the deploy script's upload step.~~ Done (story/deploy-upload-test).
3. ~~At most 20 exercises per workout.~~ Done (story/limits).

**Done in story/test-gaps (2026-11-16)**
4. ~~Error-state tests.~~ `tests/e2e/failures.spec.ts`: every screen's
   load failure and every action's failure, plus a save that recovers.
5. ~~Time zones and midnight.~~ `tests/e2e/timezones.spec.ts` (UTC+14 and
   UTC−11, a minute either side of local midnight).
6. ~~Migrations up → down → up.~~ `tests/integration/migrations.test.ts`.
   Still to do before go-live: migrate a copy of realistic data (see the
   go-live checklist).
7. ~~Two-device tests.~~ The Start race, the Change date race, and live
   date / switch / remove from another device.
8. ~~Coverage report.~~ `npm run test:coverage` with thresholds, in
   test:all and CI.
9. Manual checks on real devices: see `docs/manual-test-plan.md`
   (ongoing; replaced the per-story `manual-checks.md` on 2026-11-21).

**Later**
10. Visual regression screenshots (CI only) once screens settle.
11. Property-based tests for the calc module.
12. ~~E2E: an exercise name containing HTML shows as plain text.~~ Done
    (story/test-gaps).
13. ~~Report tests that only passed on retry in CI.~~ Done
    (`scripts/report-flaky.ts`, story/test-gaps).
14. Go-live checklist: restore a backup into a scratch instance.
15. Keep watching for the unexplained PocketBase crash (Story 5); the
    integration harness prints its output if it recurs.

## Go-live checklist (deferred until the end of development)
First deployed on 2026-11-22 (v0.1.39). Development continues locally;
deploys happen only when the tech lead asks.
These are the steps that need the tech lead or the server, in order. Each
README reference is the detailed how-to. Stories that add more server steps
(e.g. admin UI settings) add them here.

**Server setup** (README › Deployment › One-time server setup)
- [x] Point a DNS record for the app's subdomain at the server (covered
      by an existing wildcard record).
- [x] Steps 1–5: create `/opt/ironbook`, download the pinned Linux
      PocketBase, install and enable (don't start) the `ironbook` unit,
      create the superuser, add the Caddy block and reload Caddy.
- [x] On your machine: fill in the `DEPLOY_` settings in `.env`.

**First deploy** (README › Deployment › Deploying updates)
- [ ] Run the full manual test plan locally (`docs/manual-test-plan.md`)
      and record it in its run log. *(Skipped for the first deploy on
      2026-11-22, the tech lead's decision; still to do.)*
- [x] From an up-to-date `main`: `npm run deploy -- --dry-run`, then
      `npm run deploy`. Run it in your own terminal: the restart uses
      `sudo` over SSH.
- [x] Step 7 in the admin UI (`/_/`): set the Application URL, and add
      `X-Forwarded-For` as the user IP proxy header (rightmost IP).
- [x] Check: the site loads over HTTPS and shows the version from `main`.
      *(Story 4's "done when".)*

**Accounts** (README › Accounts)
- [x] In the admin UI, create your own account in the **users** collection
      (email + a strong password), and accounts for anyone you invite.
- [ ] Optional: create a demo account (tick **demo**) to hand out, and
      import the sample into it (README › Demo account sample data).
- [x] Check: you can sign in; a wrong password is refused.
- [x] Check: rate limiting is on (Settings › Application › Rate limits;
      turned on by a migration) and the proxy header from step 7 is set, so
      limits apply per visitor.

**Data and launch**
- [x] Set up scheduled backups (Settings › Backups; the server clock is
      usually UTC).
- [x] Export the Google Sheet to CSV and import it in Settings on the live
      site. *(Story 22; done 2026-11-22: 158 entries, 57 workouts, 13
      exercises.)*
- [x] Export from the live site and run `npm run compare-csv -- <sheet.csv>
      <export.csv>` (README › Checking an import against its source); it should end with
      `MATCH`. Then retire the sheet. *(MATCH on 2026-11-22.)*
- [ ] Before the next deploy that adds a migration: on your Mac, copy a
      backup of the live `pb_data` into a temporary folder, run that
      deploy's migrations against the copy (`./pocketbase migrate up --dir
      <copy> --migrationsDir pb_migrations`), and check it starts and the
      data looks right. Never upload the copy anywhere.
- [x] Bump `VERSION` to 1.0 in `src/lib/config.ts`, merge, and deploy.
      *(Deployed 2026-11-22: v1.0.42.)*

## Later (v2 and beyond)
- Integrations: Strava, Apple Health.
- Heaviest-weight PR.
- A rename-exercise screen (the data model already applies a rename
  everywhere).
- Highlighting of individual weight/rep cells in History (e.g. more reps
  than last time).
- More metrics.

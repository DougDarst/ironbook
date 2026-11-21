# CLAUDE.md

Guidance for Claude Code when working in this repo.

## Roles
- The user is the tech lead and makes all product and architecture decisions.
- Claude is the developer: propose, explain trade-offs, implement.
- When something is ambiguous, ask. Don't guess.
- Propose before deciding anything the spec leaves open (e.g. chart library,
  data-model details), with the trade-offs.

## Source of truth
- `docs/spec.md` is the spec. Its "Decisions" section records approved
  changes and wins over earlier sections where they conflict.
- Update the spec (with approval) whenever a decision changes.
- `docs/TODO.md` tracks deferred work and provisional decisions. Add to it
  whenever something is provisional or deferred.
- Approved visual design: the "Visual design" section of the spec, plus the
  mockups in `docs/design/style-guide-and-mockups.pdf` (to view it, render
  pages to PNG with macOS PDFKit via a small Swift script; poppler isn't
  installed). Confirm a screen matches the design before
  building it. The iPhone History cards were approved separately (spec
  Decisions, 2026-11-16).

## Git workflow (strict)
- Public repo: https://github.com/DougDarst/ironbook (MIT).
- Work through the spec's stories in order, one at a time.
- One branch per story (`story/<short-name>`), then a pull request. CI must
  pass. The user approves and squash-merges into `main`. `main` must always
  be deployable.
- `main` is protected by a GitHub ruleset (PR required, squash only, no
  force pushes or deletion, CI must pass, empty bypass list). Direct pushes
  to `main` are rejected, so always work on a branch. After a merge, pull
  `main` and start the next branch from it; merged branches are deleted
  automatically. See `docs/github-settings.md`, and keep it current if the
  settings change.
- Before every commit, run the full suite once: `npm run test:all` (type
  checks, unit, integration against a real PocketBase, E2E + axe). Run it
  again only if code changed after that run. While building, run just the
  affected tests. One-time setup: `npm run pb:setup` and `npx playwright
  install webkit chromium` (rerun the latter after a Playwright upgrade).
- When `npm run test:all` passes, commit, push and open the pull request
  without asking first (the user approved this on 2026-11-20 and reviews
  at the PR). Then give a short summary: what changed, the test table, the
  PR link.
- **Never merge a pull request or deploy without asking.** Ask before
  committing anything the user hasn't asked for or that a story didn't call
  for.
- Don't wait for CI after pushing: GitHub won't merge until it's green.
  Check the PR's CI at the user's next message, and fix it first if it
  failed.
- Manual testing: `docs/manual-test-plan.md`. A PR that changes what a
  screen shows or does updates its tests in the same PR (new tests get the
  next free ID; removed ones are retired, never reused). Recompute seed
  numbers with the app's calculations, not by hand.
- Keep the slower checks for where they pay off: deliberately breaking
  code to prove a test catches it (new calculations and rules), and
  screenshot comparisons (visual changes). Skip them for small fixes.
- Summaries stay short: a few lines, the test table, the PR link. Details
  go in the PR description.

## Deployment
- Self-hosted: PocketBase as the systemd service `ironbook` in
  `/opt/ironbook`, on `127.0.0.1:8092`, behind the server's Caddy for HTTPS.
- Deploy only when the user asks. Never as a side effect of other work.
- Development is local until go-live. Any step that needs the user or the
  server (setup, admin UI settings, accounts, verifying on the live site) goes
  in the go-live checklist in `docs/TODO.md`, not into a story's done-when.
- A deploy is `npm run deploy` (`scripts/deploy.sh`): checks (clean tree,
  `main` in sync with `origin/main`, server on the pinned PocketBase), build,
  rsync `pb_public`, `pb_hooks` and `pb_migrations`, restart, health check.
  Never use `--allow-branch` unless the user asks for a branch deploy, and
  never work around a refusal; report it to the user instead.
- Server settings come from `.env` (`DEPLOY_HOST`, `DEPLOY_PATH`,
  `DEPLOY_SERVICE`, `DEPLOY_PORT`). Never print or commit their values.
- **Never upload, overwrite, or delete `pb_data` on the server.** The local
  `pb_data/` is a development sandbox only.
- Keep server addresses, domains and credentials out of the repo. Use
  placeholders (`you@your-server`, `ironbook.example.com`).

## Conventions
- Stack: PocketBase (pinned in `scripts/setup-pocketbase.sh`; read release
  notes and ask before upgrading); Svelte 5 + Vite + TypeScript SPA built
  into `pb_public`; Lucide icons; fonts self-hosted via `@fontsource`.
- Node version is in `.nvmrc`.
- The app's name lives only in `APP` in `src/lib/config.ts`. Never hard-code
  it anywhere else (code, UI, page title, README).
- Dates are date-only `YYYY-MM-DD` strings. "Today" is the device's local
  date. Never do date math with timestamps.
- Computed values (volume, change, %, PRs, last time, monthly totals) are
  never stored. They live in the dependency-free `src/lib/calc/` module with
  thorough unit tests. Only done sets count (provisional).
- All schema changes are hand-written PocketBase migrations in
  `pb_migrations/`. PocketBase runs with `--automigrate=false` everywhere
  (dev, tests, server), so the admin UI and tests never write migration
  files. Keep that flag on any new `serve` command.
- Test servers and the production server run with `--hooksWatch=false`.
- Hooks: `pb_hooks/*.pb.js`. Each handler runs in its own JS context, so
  top-level helpers aren't visible inside it: keep handlers self-contained
  and `require` shared code inside the handler.
- Rules shared by app and server live in `src/lib/model/` (dependency-free
  TypeScript, unit-tested), bundled into `pb_hooks/generated/shared.cjs` by
  `npm run build:hooks`; hooks `require(`${__hooks}/generated/shared.cjs`)`.
- Throw validation errors (`BadRequestError` with field data) from
  `onRecordValidate`: thrown from `onRecordCreate`/`onRecordUpdate`,
  PocketBase replaces them with a generic error. In hooks, read JSON fields
  with `JSON.parse(record.getString(field))` (`get` returns raw bytes).
- Sign-in is email + password only. The superuser creates every account in
  the admin UI (no sign-up). Emails match ignoring case
  (`pb_hooks/auth.pb.js`). Rate limiting is on; test servers relax it via
  `tests/support/rate-limits.ts`.
- The frontend uses `VITE_PB_URL` only on the Vite dev server; builds always
  talk to their own origin.
- Every user-owned record has a `user` relation, and API rules restrict all
  operations to `user = @request.auth.id`.
- Design tokens are CSS custom properties in `src/app.css`. Use them; don't
  hard-code colors. Accent only for the primary action, done sets and PRs.
- Use real `<button>`, `<input>`, `<label>`, `<select>`; icon-only buttons
  get an `aria-label`. Touch targets at least 44 px. Phone-first (390 px).
- Tests: Vitest (unit), Vitest against a real PocketBase (integration),
  Playwright on WebKit iPhone + desktop Chromium with axe (E2E). Pick test
  cases where a wrong implementation gives a different answer.
- Each new screen or action gets E2E tests for its failure state (a dropped
  connection: `failRequests` in `tests/e2e/failures.spec.ts`) and, if it
  changes shared data, for the same change made on another device.
- Unit coverage thresholds live in `vite.config.ts`: raise them as coverage
  grows, never lower them to make a change pass.
- No secrets in the repo; use env vars and keep `.env.example` current.
- The repo is public: keep code clean, documented and safe to publish.

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
- Approved visual design: the "Visual design" section of the spec, plus
  screenshots in `docs/design/`. Confirm a screen matches the design before
  building it. The iPhone History cards need a mockup approved first.

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
- Before every commit:
  1. Run the full suite: `npm run test:all` (type checks, unit, integration
     against a real PocketBase, E2E + axe). One-time setup: `npm run
     pb:setup` and `npx playwright install webkit chromium` (rerun the
     latter after a Playwright upgrade).
  2. Show the user a summary of the changes, the test results, and the
     proposed commit message.
  3. Wait for explicit approval.
- **Never commit, push, open or merge a pull request, or deploy without
  asking.**

## Deployment
- Self-hosted: PocketBase as the systemd service `ironbook` in
  `/opt/ironbook`, on `127.0.0.1:8092`, behind the server's Caddy for HTTPS.
- Deploy only when the user asks. Never as a side effect of other work.
- A deploy is `scripts/deploy.sh`: build, rsync `pb_public`, `pb_hooks` and
  `pb_migrations`, restart the service.
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
- All schema changes are PocketBase migrations in `pb_migrations/`.
- Every user-owned record has a `user` relation, and API rules restrict all
  operations to `user = @request.auth.id`.
- Design tokens are CSS custom properties in `src/app.css`. Use them; don't
  hard-code colors. Accent only for the primary action, done sets and PRs.
- Use real `<button>`, `<input>`, `<label>`, `<select>`; icon-only buttons
  get an `aria-label`. Touch targets at least 44 px. Phone-first (390 px).
- Tests: Vitest (unit), Vitest against a real PocketBase (integration),
  Playwright on WebKit iPhone + desktop Chromium with axe (E2E). Pick test
  cases where a wrong implementation gives a different answer.
- No secrets in the repo; use env vars and keep `.env.example` current.
- The repo is public: keep code clean, documented and safe to publish.

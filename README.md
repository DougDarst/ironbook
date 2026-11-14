# A weightlifting logbook

A web app for logging weightlifting workouts and tracking the volume lifted
over time. Pick today's exercises, each opens pre-filled with last time's
weights and reps, tick sets as you lift, and watch the volume add up. Then
scroll the history and see trends. Invite-only and multi-user, with each
user's data kept separate. The app's display name is configurable; see
[Renaming the app](#renaming-the-app).

> **Status:** early development. See [docs/spec.md](docs/spec.md) for the
> full specification and [docs/TODO.md](docs/TODO.md) for open items.

## Tech stack

- **Backend:** [PocketBase](https://pocketbase.io) (database, auth, realtime,
  server-side hooks), version pinned in `scripts/setup-pocketbase.sh`
- **Frontend:** Svelte 5 + Vite + TypeScript, built as a static app that
  PocketBase serves from `pb_public`
- **Icons:** [Lucide](https://lucide.dev); **fonts:** Inter and Barlow
  Condensed, self-hosted via [Fontsource](https://fontsource.org)

## Prerequisites

- Node.js (version in `.nvmrc`; `nvm use` picks it up)
- macOS or Linux (for the PocketBase download script)

## Setup

```sh
npm install
cp .env.example .env
npm run pb:setup  # downloads the pinned PocketBase binary into ./pocketbase
```

## Local development

The first time, create an admin (superuser) account **before** starting
PocketBase. (If no superuser exists, PocketBase opens a browser tab with its
setup page every time it starts.)

```sh
./pocketbase superuser upsert you@example.com 'a-strong-password'
```

Then start PocketBase. It applies the migrations in `pb_migrations/` and
loads the hooks in `pb_hooks/`:

```sh
npm run pb:serve  # http://127.0.0.1:8092 (admin dashboard at /_/)
```

For the frontend with hot reload, run this alongside `pb:serve`:

```sh
npm run dev       # Vite dev server; talks to PocketBase at VITE_PB_URL
```

`npm run build` builds the frontend into `pb_public/`, which `pb:serve` then
serves at http://127.0.0.1:8092.

Local data lives in `pb_data/` (git-ignored). Delete it to start over.

## Testing

```sh
npm run check             # type checks (svelte-check + tsc)
npm test                  # unit tests (Vitest)
npm run test:integration  # against a real PocketBase (Vitest)
npm run test:e2e          # end-to-end + accessibility (Playwright): iPhone/WebKit and desktop Chromium
npm run test:all          # all of the above
```

The first time, install the browsers Playwright uses:

```sh
npx playwright install webkit chromium
```

Integration and end-to-end tests start their own PocketBase on a temporary
database, so they never touch `pb_data/`. End-to-end tests run against the
built app (`test:e2e` builds it first) and include automated accessibility
checks with [axe](https://github.com/dequelabs/axe-core) in both themes.

CI (GitHub Actions, `.github/workflows/ci.yml`) runs `npm run test:all` on
every push and pull request, and uploads Playwright traces when it fails.

## Contributing

Every change goes through a pull request from its own branch. CI must pass,
and pull requests are squash-merged into `main`, which is protected. The
GitHub settings that enforce this are recorded in
[docs/github-settings.md](docs/github-settings.md).

## Renaming the app

The name is defined in one place: `APP.name` in
[`src/lib/config.ts`](src/lib/config.ts). The page title, header and
everything else in the app read it from there. Change it, then rebuild.

## License

[MIT](LICENSE)

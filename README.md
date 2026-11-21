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

### Creating an account

There's no sign-up page: accounts are by invitation. To create one (your
own included), open the admin dashboard (http://127.0.0.1:8092/_/ locally),
go to the **users** collection, and add a record with an email and a
password. Then sign in to the app with them. Emails are matched ignoring
case.

### How the backend is organized

- `pb_migrations/`: the database schema, as hand-written PocketBase
  migrations. The database can be rebuilt from scratch from these.
  PocketBase runs with `--automigrate=false` everywhere (local, tests,
  server), so changing collections in the admin dashboard never writes
  migration files. Write a migration instead.
- `pb_hooks/auth.pb.js`: makes sign-in ignore the case of the email.
- `pb_hooks/logbook.pb.js`: validation and housekeeping for exercises,
  workouts and entries that API rules can't express (real dates, the
  20-slot sets shape, cross-record ownership, name normalization,
  `finished_at`).
- `src/lib/model/`: those validation rules as dependency-free TypeScript,
  shared by the app and the hooks. `npm run build:hooks` bundles them into
  `pb_hooks/generated/shared.cjs` (git-ignored; `pb:serve`, `build` and the
  integration tests build it for you, and the deploy uploads it).

## Testing

```sh
npm run check             # type checks (svelte-check + tsc)
npm test                  # unit tests (Vitest)
npm run test:coverage     # unit tests with a coverage report (coverage/), failing below the thresholds
npm run test:integration  # against a real PocketBase (Vitest)
npm run test:e2e          # end-to-end + accessibility (Playwright): iPhone/WebKit and desktop Chromium
npm run test:all          # all of the above (unit tests with coverage)
```

The first time, install the browsers Playwright uses:

```sh
npx playwright install webkit chromium
```

Integration and end-to-end tests start their own PocketBase on a temporary
database, so they never touch `pb_data/`. Tests create their own accounts
and sign in with passwords, like real users. Every test request comes from
one IP, so the test servers raise PocketBase's rate limits, except one
integration server that keeps the production limits for
`tests/integration/limits.test.ts`. End-to-end tests run against the
built app (`test:e2e` builds it first) and include automated accessibility
checks with [axe](https://github.com/dequelabs/axe-core) in both themes.
They also cover failed requests (the connection drops), changes from a
second device, an ended session, and far-off time zones around local
midnight. `tests/integration/migrations.test.ts` runs every migration up,
down and up again on throwaway databases.

Unit-test coverage of `src/lib/` and `scripts/` must stay above the
thresholds in `vite.config.ts` (the data layer and UI state are left out:
the integration and E2E tests cover them).

CI (GitHub Actions, `.github/workflows/ci.yml`) runs the same checks as
`npm run test:all` on every pull request (each push to its branch) and on
every push to `main`, split into jobs that run side by side: type checks,
unit and integration tests in one, the E2E tests once per browser (with the
downloaded browsers cached). A final `test` job, the one `main` requires,
passes only when they all do. Failed E2E runs upload their Playwright
traces. It retries a failed E2E test
once; a test that only passed on retry is listed as a warning in the run's
summary (`scripts/report-flaky.ts`).

## Deployment

The app is a single PocketBase process that serves both the API and the
built frontend. These steps self-host it on an Ubuntu server as a systemd
service, bound to `127.0.0.1:8092`, behind the server's existing
[Caddy](https://caddyserver.com), which handles HTTPS. No Docker.

In the commands below, replace `you@your-server` with your SSH login and
`ironbook.example.com` with the app's subdomain. Example config files are
in [`deploy/`](deploy/).

### One-time server setup

Before you start: point a DNS record for the subdomain at the server.

1. **Create the folder** (owned by the account the service will run as):

   ```sh
   sudo mkdir -p /opt/ironbook && sudo chown "$USER": /opt/ironbook
   ```

2. **Download the Linux PocketBase build** into it. Use the version pinned
   in `scripts/setup-pocketbase.sh`, and `arm64` instead of `amd64` on an
   ARM server:

   ```sh
   VERSION=0.40.6
   cd /opt/ironbook
   curl -fsSLO "https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}/pocketbase_${VERSION}_linux_amd64.zip"
   unzip "pocketbase_${VERSION}_linux_amd64.zip" pocketbase && rm "pocketbase_${VERSION}_linux_amd64.zip"
   ./pocketbase --version
   ```

3. **Create and enable the unit, but don't start it.** Copy
   [`deploy/ironbook.service`](deploy/ironbook.service) to
   `/etc/systemd/system/ironbook.service`, set `User` and `Group` to the
   account that owns `/opt/ironbook`, then:

   ```sh
   sudo systemctl daemon-reload
   sudo systemctl enable ironbook
   ```

4. **Create the superuser** (the admin account) before the first start:

   ```sh
   /opt/ironbook/pocketbase superuser upsert you@example.com 'a-strong-password' --dir=/opt/ironbook/pb_data
   ```

5. **Add the Caddy block** from
   [`deploy/Caddyfile.example`](deploy/Caddyfile.example) to
   `/etc/caddy/Caddyfile`, then:

   ```sh
   sudo systemctl reload caddy
   ```

6. **Upload the code, then start the service.** On your machine, in the
   repo, fill in the `DEPLOY_` settings in `.env` (see
   [`.env.example`](.env.example)), then run the deploy script. It builds,
   uploads, and (re)starts the service:

   ```sh
   npm run deploy
   ```

7. **Configure PocketBase** at `https://ironbook.example.com/_/` (sign in as
   the superuser), under **Settings → Application**:
   - **Application URL:** `https://ironbook.example.com`.
   - **User IP proxy headers:** add `X-Forwarded-For`, and keep it using
     the **rightmost** IP (leave "use leftmost IP" off). Caddy appends each
     visitor's real address to that header; without it, PocketBase logs
     every request as coming from `127.0.0.1`, and the sign-in rate limit
     would apply to everyone at once.

### Deploying updates

Deploy only from `main`, after its pull request is merged:

```sh
git checkout main && git pull
npm run deploy               # build, upload, restart, health check
npm run deploy -- --dry-run  # show what would change, without uploading or restarting
```

[`scripts/deploy.sh`](scripts/deploy.sh):

1. checks first, and changes nothing if any check fails:
   - the working tree is clean;
   - you're on `main`, in sync with `origin/main`;
   - the server runs the pinned PocketBase version;
2. runs `npm run build`;
3. rsyncs `pb_public`, `pb_hooks` and `pb_migrations` to the server;
4. restarts the service and waits for it to report healthy.

PocketBase applies any new migrations when it starts. To deliberately
deploy a branch (e.g. to check something on the server before merging), use
`npm run deploy -- --allow-branch`; the version shown in the app then has
the branch's commit hash.

> **The deploy never touches `pb_data/`.** The server holds the live data.
> The script only sends the three folders above, never sends a `pb_data`
> folder, and refuses to run if asked to include it. Your local `pb_data/`
> is a development sandbox. The upload step
> ([`scripts/deploy-upload.sh`](scripts/deploy-upload.sh)) is tested with a
> real rsync against temporary folders. It works with macOS's built-in
> rsync (openrsync); a third safeguard (rsync's "protect" rule) only takes
> effect with GNU rsync (`brew install rsync`).

Check the service with `sudo systemctl status ironbook`, and its logs with
`sudo journalctl -u ironbook`.

### Accounts

After the first deploy, in the admin dashboard
(`https://ironbook.example.com/_/`):

- **Create accounts** in the **users** collection: an email and a first
  password for each person, yourself included. Give each person their
  password; they can change it in Settings.
- **Forgotten password:** open the user's record and set a new password.
- **Remove someone:** delete their user record. They're signed out the next
  time they open the app.
- **Demo account:** create an account as usual and tick **demo**. Hand its
  email and password to whoever you like; don't publish them. Visitors
  share it, so a demo account can't change its own record (name, password,
  anything). Only you can, in the dashboard.

Rate limiting is set by migrations: at most 2 sign-in attempts per 3
seconds per visitor, and generous limits on creating records for signed-in
users (so starting a workout or importing history isn't throttled). It needs the proxy header from step 7, or every
visitor shares one limit.

### Upgrading PocketBase

PocketBase is pre-1.0, so read the release notes for every version in
between before upgrading. Change `VERSION` in
`scripts/setup-pocketbase.sh`, run `npm run pb:setup` and the full test
suite locally, then replace the binary in `/opt/ironbook` on the server
(step 2) and deploy. The deploy script refuses to run while the server and
the repo disagree on the version.

### Backups

PocketBase has built-in scheduled backups: in the admin dashboard, go to
**Settings → Backups**. The server's clock is usually UTC when setting the
schedule.

## Version number

The app shows its version in the laptop header and on the Settings screen,
e.g. `v0.1.47 (a3f9c1e)`:

- **major.minor** are set by hand in `VERSION` in
  [`src/lib/config.ts`](src/lib/config.ts);
- the **last number** is the commit count of the built branch
  (`git rev-list --count HEAD`);
- **in parentheses** is the short commit hash, with `-dirty` if the build
  had uncommitted changes.

It's stamped automatically at build time, so every build after a new commit
shows a new number. A build made outside a git clone (or from a shallow
clone, whose commit count is wrong) shows `(unknown)` instead.

## Contributing

Every change goes through a pull request from its own branch. CI must pass,
and pull requests are squash-merged into `main`, which is protected. The
GitHub settings that enforce this are recorded in
[docs/github-settings.md](docs/github-settings.md).

## Renaming the app

The name is defined in one place: `APP.name` in
[`src/lib/config.ts`](src/lib/config.ts). The page title, header and
everything else in the app read it from there. Change it, then rebuild.

The server identifiers (the `ironbook` service, the `/opt/ironbook`
folder, the `DEPLOY_` settings) are independent of the display name, so a
rename doesn't need to touch the server.

## License

[MIT](LICENSE)

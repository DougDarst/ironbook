# TODO

Deferred work and provisional decisions. See [spec.md](spec.md) for the
source of truth.

## Provisional (revisit after using the app)
- **Only done sets count.** Volume, change, PRs, charts, monthly totals and
  export use done sets only. Revisit after real use.

## Open decisions (to propose at the relevant story)
- Data model details, including one JSON `sets` field per entry vs a
  separate `sets` collection (Story 8, before the first migration).
- Chart library or hand-built SVG (Story 17).
- iPhone History card mockup (Story 15).
- Design screenshots to be added to `docs/design/` by the tech lead.

## Go-live checklist (deferred until the end of development)
Development happens locally; nothing is deployed until the app is ready.
These are the steps that need the tech lead or the server, in order. Each
README reference is the detailed how-to. Stories that add more server steps
(e.g. Google sign-in) add them here.

**Server setup** (README › Deployment › One-time server setup)
- [ ] Point a DNS record for the app's subdomain at the server.
- [ ] Steps 1–5: create `/opt/ironbook`, download the pinned Linux
      PocketBase, install and enable (don't start) the `ironbook` unit,
      create the superuser, add the Caddy block and reload Caddy.
- [ ] Make sure the unit does **not** set `IRONBOOK_TEST_AUTH`, so password
      sign-in stays blocked on the live site (Story 6).
- [ ] On your machine: fill in the `DEPLOY_` settings in `.env`.

**First deploy** (README › Deployment › Deploying updates)
- [ ] From an up-to-date `main`: `npm run deploy -- --dry-run`, then
      `npm run deploy`. Run it in your own terminal: the restart uses
      `sudo` over SSH.
- [ ] Step 7 in the admin UI (`/_/`): set the Application URL, and add
      `X-Forwarded-For` as the user IP proxy header (rightmost IP).
- [ ] Check: the site loads over HTTPS and shows the version from `main`.
      *(Story 4's "done when".)*

**Sign-in** (README › Google OAuth setup, written in Story 5)
- [ ] Create the Google OAuth client with the redirect URI
      `https://<app-domain>/api/oauth2-redirect`.
- [ ] Configure the Google provider in the admin UI (after the Application
      URL is set).
- [ ] Add your email (and any invitees) to `allowed_emails`.
- [ ] Check: an allowed email can sign in, and another Google account gets
      "This account isn't invited". *(Story 5's "done when".)*
- [ ] Check: password sign-in is refused on the live site.

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
- Renaming an exercise everywhere at once (v1 only moves a single entry to
  another exercise).
- Highlighting of individual weight/rep cells in History (e.g. more reps
  than last time).
- More metrics.

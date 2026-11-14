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

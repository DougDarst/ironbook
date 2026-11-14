# Build Ironbook — a weightlifting logbook

> This is the source of truth for the app. Approved changes are recorded in
> [Decisions](#decisions) at the end, which win over earlier sections where
> they conflict. Deferred and provisional items live in
> [TODO.md](TODO.md).

## Roles
I'm the tech lead and you (Claude Code) are the developer. I make the product
and architecture decisions. You propose, explain trade-offs, and implement.
When something is ambiguous, ask me. Don't guess.

Create a `CLAUDE.md` at the repo root that captures these roles, the
conventions below, and the git workflow, so they persist across sessions.
Keep this spec in the repo at `docs/spec.md` as the source of truth, and
update it (with my approval) when decisions change. Track deferred items and
provisional decisions in `docs/TODO.md`.

## Goal
A web app for logging weightlifting workouts and tracking the volume lifted
over time. It replaces a Google Sheet I use today. After a one-time import of
my history, the app's database is the source of truth.

The core loop: pick today's exercises, each one opens pre-filled with last
time's weights and reps, adjust while lifting, tick each set as it's done,
and watch the volume add up live. Afterwards, scroll the history and see
trends.

Multi-user: invite-only, each user's data fully separate. The repo is public
and open source, so code must be clean, documented, and safe to publish.

## Naming
- The app is called "Ironbook", and I may rename it.
- Define the name in ONE config constant. Nothing else in the code, UI, page
  title, or README should hard-code it. Document how to rename it in the
  README.

## Stack and hosting
Built the same way as my other app, BeDone (github.com/DougDarst/bedone).
Reuse its patterns where they fit.

- **Backend:** PocketBase (database, auth, API, realtime, server-side hooks).
  Pin the version in the repo (BeDone uses 0.40.6; check with me before
  using a newer one). PocketBase is pre-1.0, so read release notes before any
  upgrade.
- **Frontend:** Svelte 5 + Vite + TypeScript, built as a static single-page
  app into `pb_public` and served by the same PocketBase instance.
- **Charts:** propose a library (or hand-built SVG) and explain why. It must
  look good on iPhone and laptop, support both themes, and stay small.
- **Icons:** Lucide.
- **Node:** 26 (pin in `.nvmrc`). *(Changed from 24 on 2026-11-13; see
  Decisions.)*
- All schema changes are PocketBase migrations in the repo.
- No Docker. On the server PocketBase runs as a systemd service, bound to
  `127.0.0.1`, behind the server's existing Caddy, which handles HTTPS.

## Deployment
- Self-hosted on my Ubuntu server, alongside my other PocketBase apps.
  - Folder `/opt/ironbook` (binary, `pb_data`, `pb_public`, `pb_hooks`,
    `pb_migrations`)
  - Port `127.0.0.1:8092`
  - systemd service `ironbook`
  - One new Caddy block for the app's subdomain
- Provide `deploy/ironbook.service` and `deploy/Caddyfile.example` like
  BeDone's, with placeholders.
- Provide a deploy script (`scripts/deploy.sh`) that:
  1. runs `npm run build`,
  2. rsyncs `pb_public`, `pb_hooks` and `pb_migrations` to the server,
  3. restarts the service.

  It reads the host and path from `.env` (git-ignored). It must **never**
  upload, overwrite, or delete `pb_data`, and should refuse to run if asked
  to.
- Deploy only when I ask. Never deploy as a side effect of other work.
- Keep server addresses, domains, and credentials out of the repo. Use
  placeholders (`you@your-server`, `ironbook.example.com`) in docs.
- README covers first-time server setup, matching my server's pattern:
  1. Create the folder.
  2. Download the Linux PocketBase build.
  3. Create and enable the unit (don't start it).
  4. Create the superuser.
  5. Add the Caddy block and reload Caddy.
  6. rsync the code, then start the service.
  7. In the admin UI, set the Application URL and the trusted proxy header
     (`X-Forwarded-For`, rightmost IP).

## Version number
- Shown in the app (Settings screen and the laptop header), e.g.
  `v1.2.47 (a3f9c1e)`.
- Major and minor are set by hand in the config. The last number is the
  commit count on the built branch (`git rev-list --count HEAD`). The part in
  parentheses is the short commit hash.
- Stamped automatically at build time (e.g. via a Vite `define`), so every
  build after a new commit shows a new number.

## Authentication and users
*(Changed 2026-11-13 from Google sign-in; see Decisions.)*
- **Email and password sign-in only**, for everyone, using PocketBase's
  built-in password auth. No public sign-up and no third-party auth service.
- **Accounts are the invitation.** The superuser creates each account (email
  and a first password) in the PocketBase admin UI and gives the person the
  password. API rules allow no other way to create a user.
- **Passwords.**
  - Users change their own password in Settings (current password
    required).
  - "Forgot password" means the superuser sets a new one in the admin UI.
    No password-reset emails (no SMTP) in v1.
  - The sign-in error never reveals whether an email has an account.
- **Emails match ignoring case** at sign-in (iPhone keyboards capitalize),
  and are unique ignoring case.
- **Rate limiting** is on (PocketBase's built-in limits, enabled by a
  migration), mainly to slow password guessing. It relies on the server
  trusting Caddy's `X-Forwarded-For` header.
- **Data isolation.**
  - Every user-owned record has a `user` relation.
  - Every collection's API rules restrict list, view, create, update and
    delete to `user = @request.auth.id`.
  - Integration tests must prove one user can't read or change another's
    data.

## Platform targets
- Chrome on macOS (laptop) and Chrome on iPhone. Design phone-first. Every
  screen must work well at 390 px wide and at laptop widths.
- Online only. No offline mode.
- Touch targets at least 44 px.

## Core concepts and rules
- **Exercise:** a named lift, free-form, created by the user (e.g. "Barbell
  Bench Press"). Names are unique per user, case-insensitive.
- **Workout:** one per user per calendar date. A workout holds one or more
  exercises.
- **Entry:** one exercise within one workout. It has exactly 20 set slots.
  Each slot holds weight (lbs), reps, and done (true/false). Slots may be
  empty. Fewer than 20 sets is normal.
- **Units:** pounds only. Weights may be decimals (e.g. 2.5).
- **Only done sets count.** Volume, change, PRs, charts, monthly totals and
  export all use done sets only. (Provisional: I may revisit this after
  using the app. Note it in `docs/TODO.md`.)
- **Volume** of an entry = sum of weight × reps over its done sets.
- **Draft vs finished.**
  - A workout saves as you go, and stays a draft until I tap "Finish
    workout".
  - Drafts don't count anywhere: not in History, metrics, prefill sources or
    PRs.
  - A draft can be continued on any device, or deleted.
- **Last time (prefill source):** for an exercise on a given date, the most
  recent *finished* workout before that date that includes the exercise.
- **Change vs last time:** this entry's volume minus last time's volume,
  and the same as a percentage of last time's. Blank for the first session.
- **Volume PR:** an entry whose volume is higher than every earlier finished
  session of that exercise. The first-ever session counts as a PR.
- **Monthly total:** sum of entry volumes for one exercise per calendar
  month.
- **Computed, not stored.** All of the above are computed when shown. The
  database stores only what I enter. Put these calculations in one
  dependency-free module (e.g. `src/lib/calc/`) with thorough unit tests.
- **Dates** are date-only `YYYY-MM-DD` strings. "Today" is the device's local
  date. Never do date math with timestamps.

## Data model (proposed; confirm with me before the first migration)
- `users` (auth collection): name, email, `theme` (`system` | `light` |
  `dark`, default `system`).
- `exercises`: `user`, `name`. Unique (user, lower(name)).
- `workouts`: `user`, `date` (YYYY-MM-DD), `status` (`draft` | `finished`),
  `finished_at`. Unique (user, date).
- `entries`: `user`, `workout`, `exercise`, `position` (order in the
  workout), `sets` (JSON array of exactly 20 `{weight, reps, done}` objects;
  empty slots are `null` weight/reps).
  - Validate the shape in a hook.
  - Unique (workout, exercise).
  - Trade-off to confirm: one JSON field per entry keeps saves to a single
    write and matches the 20-slot model. A separate `sets` collection is
    more relational but means 20 records per entry.

## Screens
Navigation:
- iPhone: a bottom tab bar (Log, History, Metrics), with Settings as a gear
  button in the header.
- Laptop: the same items in a top bar, with the version number on the right.

### Choose exercises (start of a workout)
- Opens when I tap Log and there's no workout for today.
  - If today's workout exists (draft or finished), Log opens it instead.
- Shows the date (default today, changeable so I can log after the fact)
  and a search box.
- Lists all my exercises. Each shows its last date and volume.
- Tap to select several, or add a new exercise by name.
- "Start workout (N)" creates a draft workout with one entry per selected
  exercise, in the order selected.
  - Each entry is pre-filled from last time: weights and reps copied, all
    sets not done.
  - A new exercise starts with 20 empty sets.
- No adding or removing exercises after the workout starts.
- Empty state (new user, no exercises): only "New exercise", with a short
  hint.

### Log a workout (the data-entry screen; speed matters most)
- Header: date and workout options (delete workout).
- Exercise tabs (pills) switch between the day's entries.
- Summary card for the current exercise:
  - name, sets done out of 20,
  - "Lifted" (done volume, large),
  - planned volume (all entered sets),
  - last time's date and volume,
  - a progress bar.
- Sets table:
  - Columns: Set, Lbs, Reps, Vol, Done. The column header row stays pinned
    while scrolling.
  - Sets in groups of 5. Each group header shows done volume / group volume.
  - Rows: set number, weight input, ×, reps input, set volume, done button.
  - A done row is tinted, and its inputs and button use the accent color.
- **Fast entry**, carried over from my current prototype page:
  - number inputs open the numeric keypad (`inputmode="decimal"` for weight,
    `"numeric"` for reps),
  - tapping an input selects its contents,
  - the keyboard's Next/Enter moves weight → reps → next set's weight.
- All totals update live as I type or tick.
- **Save as you go:**
  - Debounce about 700 ms after the last change.
  - Show an unobtrusive saved/saving status.
  - Use realtime so the same draft open on another device updates. Never
    overwrite an input I'm currently typing in.
- "Finish workout" (bottom bar, primary button) marks the workout finished.
- Deleting a workout asks for confirmation (an in-page dialog).

### Edit a past workout
- Opened by tapping a session in History. Uses the same Log screen.
- Editable:
  - sets, weights, reps and done,
  - the workout date (must not collide with another workout),
  - which exercise an entry belongs to.
- Delete is available here too. Changes save as you go.

### History
- Grouped by exercise; within each exercise, oldest first.
- A filter to show one exercise (default: all).
- **Laptop:** a spreadsheet-style grid, like my Google Sheet.
  - Columns: Date | sets 1–20 | Volume | Change | %. Each set cell shows
    `lbs×reps`. Only done sets are shown.
  - The header row and the Date column stay pinned while scrolling.
  - A month divider (label plus accent rule) separates months.
  - A "PR" badge marks volume PRs.
  - Clicking a date opens that workout for editing.
  - No highlighting of individual weight or rep cells.
- **iPhone:** one compact card per session: date, sets in rows of 5,
  volume, change and %, PR badge, with month dividers. **Mock this up for my
  approval before building it.**
- Empty state for a new user.

### Metrics
- Exercise selector (default: the most recently logged).
- **Volume per session** for that lift:
  - A line chart of finished sessions over time, with volume PRs marked.
  - Range buttons: 3M, 1Y, All (default All).
  - A headline with the latest volume, its change vs last time, and a PR
    badge if it was one.
- **Monthly total volume** for that lift: a bar chart. The current
  (incomplete) month is visually distinct.
- Works on iPhone and laptop. On laptop the two charts may sit side by side.

### Settings
- Theme: System / Light / Dark (saved on the user record).
- Change password (current password, new password twice).
- Import from CSV (see below).
- Export to CSV.
- Sign out.
- Version number.

## CSV import and export
- **Format:** one row per entry. Columns:
  - Exercise
  - Date (`M/D/YY`, e.g. `11/10/26`)
  - W1, R1 … W20, R20
  - Volume (optional; ignored on import)

  This matches my Google Sheet's export, minus its two blank columns. Be
  tolerant of a header row, blank columns, blank rows and thousands
  separators.
- **Import** (Settings, for the signed-in user only):
  - Upload, then a preview: rows, exercises, date range, any errors with row
    numbers.
  - Then confirm.
  - Creates missing exercises by name.
  - Groups rows with the same date into one finished workout.
  - Marks every imported set as done.
  - Refuses rows whose date and exercise already exist (report them). Never
    silently overwrite.
  - Recalculates volume rather than trusting the Volume column.
- **Export:** all finished workouts for the signed-in user, in the same
  format plus a Volume column, so an export can be re-imported. Done sets
  only. Sorted by exercise, then date.

## Visual design (approved 2026-11-13)
The approved style guide and mockups are on a Claude design canvas. I'll add
screenshots to `docs/design/`. This section is the written source of truth.

**Character:** a lifting logbook. Plain 1 px rules and tabular numbers like a
ledger, and one strong accent used only for the primary action, done sets
and PRs. Comfortable density. No gradients, no emoji, shadows only on the
bottom action bar.

**Themes:** follow the device setting by default, with a manual override in
Settings. Tokens:

| Token | Light | Dark |
|---|---|---|
| background | `#F4F2EE` | `#111214` |
| surface | `#FFFFFF` | `#1B1D20` |
| raised (headers, inputs) | `#F9F8F5` | `#24272B` |
| ink (text) | `#1B1D21` | `#ECEBE8` |
| muted text | `#5C6068` | `#A3A6AB` |
| line | `#E3DFD7` | `#2F3237` |
| accent | `#C2410C` | `#F2783A` |
| text on accent | `#FFFFFF` | `#1A0E07` |
| accent soft (badges) | `#FCEADF` | `#3B2417` |
| done row tint | `#FDF3EC` | `#2A1E16` |

All text pairs must meet 4.5:1 contrast.

**Type:**
- Headings: Barlow Condensed (600/700, uppercase for screen titles).
- Everything else: Inter.
- Numbers use tabular figures.

| Role | Style |
|---|---|
| Display (screen title, date) | Barlow Condensed 700, 30–32 px, uppercase |
| Title (exercise name) | Barlow Condensed 600, 20–22 px |
| Label | Inter 600, 11–12 px, uppercase, +1 px tracking, muted |
| Body | Inter 400, 16 px |
| Number input | Inter 600, 18–20 px, tabular |
| Small | Inter 400, 13 px |

**Spacing and shape:**
- 4 px scale (4, 8, 12, 16, 24, 32, 48).
- Set rows 52 px tall.
- Corners: cards 14 px, inputs and buttons 10 px, badges and pills fully
  rounded.

**Components** (match the mockups):
- Primary button (accent fill).
- Secondary button (surface and line).
- Exercise pills (selected = ink fill).
- Summary card with progress bar.
- Pinned column header.
- Set group header with volumes.
- Set row in its normal, editing (2 px ink outline) and done states.
- 44 px done button with check icon.
- "PR" badge (accent soft background, accent text).
- Month divider (uppercase label plus 2 px accent rule).
- Bottom tab bar with active item in accent.

Use real `<button>`, `<input>`, `<label>` and `<select>` elements; give
icon-only buttons an `aria-label`.

## Testing
- **Unit (Vitest):**
  - the calc module: volume, change, %, PRs, last time, monthly totals,
    done-only rule;
  - CSV parse and export, including messy input;
  - date helpers.
- **Integration (Vitest against a real PocketBase):**
  - migrations;
  - API rules and per-user data isolation;
  - sign-in: superuser-created accounts only, case-insensitive email,
    password changes, rate limiting turned on;
  - one workout per date;
  - entry validation.
  - Pick cases where a wrong implementation gives a different answer.
- **End-to-end (Playwright):** WebKit iPhone and desktop Chromium.
  - Covers: choose exercises → prefill → enter and tick sets → live totals →
    autosave → finish → History → edit → Metrics → import and export →
    theme → sign out.
  - Include automated accessibility checks with axe (as in BeDone).
- `npm run test:all` runs everything: type checks, unit, integration and E2E.
- **CI:** a GitHub Actions workflow runs `npm run test:all` on every pull
  request and every push to `main` (model it on BeDone's `ci.yml`),
  uploading Playwright traces on failure. *(Changed 2026-11-13; see
  Decisions.)*

## Git workflow
- Public repo: https://github.com/DougDarst/ironbook, MIT license.
- README covers:
  - what the app is,
  - setup,
  - local development (including creating a superuser and adding an allowed
    email),
  - creating accounts and resetting passwords,
  - manual self-hosted deployment,
  - how to rename the app.
- **One branch per story** (e.g. `story/log-prefill`). Open a pull request;
  CI must pass. I approve, then squash-merge into `main`. `main` must always
  be deployable.
- **Before every commit:**
  1. Run the full test suite.
  2. Show me a summary of the changes, the test results, and the proposed
     commit message.
  3. Wait for my explicit approval.
- **Never commit, push, open or merge a pull request, or deploy without
  asking.**

## How to work
- Work through the stories below in order, one at a time. Each ends with
  passing tests and a commit request.
- Before building any screen, confirm it matches the approved design. For
  the iPhone History cards, show me a mockup first.
- Propose before deciding anything this spec leaves open (chart library,
  data-model details), and explain the trade-offs.
- Add anything provisional or deferred to `docs/TODO.md`.

## Stories (v1)

### Epic 1 — Foundation
1. **Project skeleton.**
   - Repo, MIT license, `CLAUDE.md`, `docs/spec.md`, `docs/TODO.md`.
   - Svelte + Vite + TypeScript; PocketBase setup script with a pinned
     version.
   - App name in one config constant.
   - *Done when* `npm run pb:serve` and `npm run dev` run locally and an
     empty app shell loads in both themes.
2. **CI.**
   - The GitHub Actions workflow and `npm run test:all` with a first
     passing unit test and E2E smoke test.
   - *Done when* a push shows a green check.
3. **Version stamp.**
   - Build-time version shown in the shell.
   - *Done when* a new commit plus build shows a new number, and a test
     covers the formatting.
4. **Deploy kit.**
   - `deploy/` files, `scripts/deploy.sh` (refuses to touch `pb_data`),
     README deployment section.
   - *Done when* I've deployed the empty shell to my server and it loads
     over HTTPS.

### Epic 2 — Accounts
*(Reworked 2026-11-13 for password sign-in; see Decisions.)*
5. **Password sign-in.**
   - `users` rules (no public sign-up; own record only), case-insensitive
     email, rate limiting on.
   - Sign-in screen; session refresh on load.
   - *Done when* integration tests prove only the superuser can create
     accounts and sign-in works as specified, and E2E tests sign in through
     the form.
6. *(Merged into Story 5: tests sign in with passwords like everyone else.)*
7. **Settings, theme and sign out.**
   - System/Light/Dark saved to the user.
   - Change password.
   - Sign out.
   - Version shown.

### Epic 3 — Data model
8. **Collections and rules.**
   - The migrations for exercises, workouts and entries, with API rules and
     validation hooks.
   - *Done when* integration tests prove isolation between users, one
     workout per date, unique exercise names, and the 20-slot entry shape.
9. **Calc module.**
   - Volume, change, %, PRs, last time, monthly totals, done-only.
   - *Done when* unit tests cover edge cases: empty sets, all sets undone,
     first session, ties (a tie is not a PR), drafts excluded.

### Epic 4 — Log a workout
10. **Choose exercises.**
    - Picker, search, new exercise, date choice, empty state.
    - Creates a prefilled draft.
11. **Set entry.**
    - The Log screen per the design: tabs, summary card, pinned header,
      groups, rows, done toggle.
    - Live totals and fast keyboard entry.
    - *Done when* E2E on iPhone covers entering a full exercise using only
      the keypad and Next.
12. **Save as you go and realtime.**
    - Debounced autosave with status.
    - Realtime sync between devices that never clobbers the field being
      edited.
13. **Finish and delete.**
    - Finish moves the workout out of draft.
    - Delete with confirmation.
    - Log opens today's existing workout.

### Epic 5 — History and editing
14. **History, laptop grid.**
    - Grouped by exercise, oldest first.
    - Filter; pinned header and Date column.
    - Month dividers, PR badges, Change and % columns.
15. **History, iPhone cards.** Mockup for my approval first, then build.
16. **Edit a past workout.**
    - Open from History.
    - Edit sets, date (collision check) and exercise.
    - Delete.

### Epic 6 — Metrics
17. **Chart library decision.** A short proposal for me to approve.
18. **Volume trend.**
    - Per-lift line chart with PR markers, the 3M/1Y/All range, and the
      headline.
    - Both themes, iPhone and laptop.
19. **Monthly totals.** Per-lift bar chart; the current month is distinct.

### Epic 7 — Import and export
20. **CSV export.** Settings → Export, in the format above. A round-trip
    test (export, then import into a fresh user, gives identical data).
21. **CSV import.**
    - Upload, preview with errors, then confirm.
    - Grouping by date, all sets done, duplicate refusal.
    - Unit tests with a sample shaped like my sheet.
22. **Import my history.**
    - I export my Google Sheet to CSV and import it on the server.
    - We spot-check volumes against the sheet before I retire it.

## Later (v2 and beyond; keep in `docs/TODO.md`)
- Sign in with Google (or passkeys) as an alternative to passwords.
- Password-reset emails (needs SMTP).
- Integrations: Strava, Apple Health.
- Heaviest-weight PR.
- Revisit "only done sets count".
- Renaming an exercise everywhere at once (v1 only lets you move a single
  entry to another exercise).
- Highlighting of individual weight/rep cells in History (e.g. more reps
  than last time).
- More metrics.

## Decisions
Approved decisions, newest last. These win over earlier sections.

- **2026-11-13 — Node 26.** Pin Node 26 in `.nvmrc` (was 24), to match
  BeDone and the development machine.
- **2026-11-13 — Repo start.** `main` begins with an empty initial commit;
  Story 1 is the first story branch and pull request like every other.
- **2026-11-13 — Fonts are self-hosted** via `@fontsource` packages, bundled
  into `pb_public`. No requests to Google Fonts.
- **2026-11-13 — `main` is protected** by a GitHub ruleset: pull request
  required (0 approvals), squash merge only, no force pushes or deletion,
  the CI check must pass, and an empty bypass list. Merged branches are
  deleted automatically. Details in
  [github-settings.md](github-settings.md).
- **2026-11-13 — CI triggers.** CI runs on pull requests and on pushes to
  `main` only (was every push), so each PR commit is tested once instead of
  twice. A branch pushed without a PR isn't tested; every story branch gets
  a PR, so nothing is lost.
- **2026-11-13 — Version starts at 0.1.** Major.minor is `0.1` while the
  app is being built; bump to `1.0` when the Google Sheet is retired
  (Story 22).
- **2026-11-13 — Dirty builds are marked.** A build with uncommitted
  changes shows `-dirty` after the hash, e.g. `v0.1.3 (bf2e70d-dirty)`. A
  build without usable git info (no clone, or a shallow clone) shows
  `v0.1 (unknown)`. The deploy script refuses a dirty tree.
- **2026-11-13 — Deploy guards.** `scripts/deploy.sh` (`npm run deploy`)
  deploys only a clean `main` in sync with `origin/main`; `--allow-branch`
  deliberately deploys another branch. It also refuses to run if the
  server's PocketBase differs from the pinned version, and supports
  `--dry-run`. After restarting it waits for `/api/health`.
- **2026-11-13 — Deployment deferred.** Development stays local until the
  app is ready. Server verification steps (Story 4's deploy, Story 5's
  sign-in check on the server, Story 22's import) move to the go-live
  checklist in [TODO.md](TODO.md); those stories are done when everything
  short of the server step is built and tested.
- **2026-11-13 — Password sign-in only (replaces Google sign-in).** Google
  OAuth cost more than it gave for a handful of invited users (Google Cloud
  setup, test-user lists, a popup flow, separate test sign-in) and made a
  demo account impossible. Everyone, including the owner, signs in with
  email and password. The superuser creates accounts in the admin UI, which
  replaces the `allowed_emails` invite list; Story 6's test-only password
  flag is no longer needed. `users`: create and delete superuser-only;
  list/view/update own record; OAuth2, OTP and MFA off; emails unique and
  matched ignoring case. Rate limiting on. Change password goes in Settings
  (Story 7); forgotten passwords are reset by the superuser.
- **2026-11-13 — No automigrate.** PocketBase runs with
  `--automigrate=false` everywhere; migrations are hand-written. Test
  servers and the production server also run with `--hooksWatch=false`, so
  a hook file changing (e.g. mid-deploy) never restarts PocketBase.

# Manual test plan

A hands-on pass through the whole app, run locally before a release (and
after any change big enough to be worth it). The automated suite already
proves the rules in detail (`npm run test:all`). This plan covers what it
can't: real devices, the real keyboard and date picker, how screens look
and feel, and the app working as a whole.

It is ordered to keep device switching to a minimum:

| Part | Device | Time (about) |
| --- | --- | --- |
| [Setup](#setup-s) | Mac | 10 min |
| [1. Mac](#part-1--mac-chrome-m) | Mac, Chrome | 50 min |
| [2. Admin and accounts](#part-2--admin-and-accounts-optional-a) (optional) | Mac, Chrome | 15 min |
| [3. Both devices](#part-3--both-devices-x) | Mac + iPhone side by side | 15 min |
| [4. iPhone](#part-4--iphone-chrome-p) | iPhone, Chrome | 30 min |

Each part starts where the previous one left off, so run them in order.
Skip any test you like; later tests say what they depend on.

## How to use it

- **IDs** like `M-LOG-07` (`M` Mac, `A` admin, `X` both devices, `P`
  iPhone, then the area and a number) identify a test. Report a problem by
  its ID. IDs never change: a new test gets the next free number (even if
  it sits between others), and a removed test's ID is retired, not reused.
- **★ marks the smoke set:** about 20 minutes, for a quick check after a
  small change. Run them in the same order, skipping the rest.
- Each test is "do this → expect that". Tick the box when it passes. When
  something fails, note the ID and what you saw, and carry on.
- **Expected numbers** come from the seed data imported in Part 1 (the
  automated calculations produce exactly these). Dates are shown as on
  screen in 2026; in a later year, dates in other years also show the year
  (e.g. "Fri, Oct 9, 2026"). `<today>` means today's date in the form the
  screen uses (`M/D` in History, e.g. 11/21).
- The run log at the bottom records each run.

## Setup (S)

Test data lives in [manual-test-data/](manual-test-data/):
`seed.csv` (12 entries, 8 workouts, Sep–Oct 2026) and `seed-extra.csv`
(2 good rows plus 6 rows that must be refused).

- [ ] **S-01** ★ Start from a fresh database. Stop PocketBase if it's
      running, then keep your current data aside:
      `mv pb_data ../ironbook-pb_data.before-test-$(date +%F)` (move it back
      afterwards to return to it).
- [ ] **S-02** ★ Create the superuser (admin) before the first start:
      `./pocketbase superuser upsert you@example.com 'a-strong-password'`.
- [ ] **S-03** ★ Build and start, listening on the local network so the
      iPhone can reach it later:
      `npm run build && ./pocketbase serve --http 0.0.0.0:8092 --automigrate=false`.
      Leave this terminal open. Note your Mac's IP for Part 3:
      `ipconfig getifaddr en0`.
- [ ] **S-04** ★ In Chrome, open the admin UI at `http://localhost:8092/_/`,
      sign in as the superuser, and in **users** create two accounts:
      `tester@example.com` and `other@example.com`, each with a password of
      at least 8 characters. Write down both passwords.
- [ ] **S-05** Record the version in the run log (Settings shows it after
      sign-in, e.g. `v0.1.37 (4c97f66)`). `-dirty` after the hash means the
      checkout had uncommitted or untracked files when it was built (even
      ones outside the app, such as local design files); note it, it isn't
      a failure.

## Part 1 — Mac, Chrome (M)

Open `http://localhost:8092` in a normal Chrome window, at least 1024 px
wide.

### Sign in (M-SIGN)

- [ ] **M-SIGN-01** The page shows the sign-in card ("Your lifting
      logbook.", Email, Password, Sign in) and the browser tab shows the
      dumbbell icon.
- [ ] **M-SIGN-02** A wrong password for `tester@example.com` → "That email
      and password don't match."; the password field is cleared and
      focused.
- [ ] **M-SIGN-03** An email with no account (`nobody@example.com`) → the
      same message (it never reveals whether an account exists).
- [ ] **M-SIGN-04** Press Sign in with a wrong password three times within
      a couple of seconds → "Too many attempts. Wait a few seconds and try
      again." Wait 5 s.
- [ ] **M-SIGN-05** Stop PocketBase (Ctrl+C in its terminal), try to sign
      in → "Couldn't reach the server. Check your connection and try
      again." Start it again (same command as S-03).
- [ ] **M-SIGN-06** ★ Sign in as `TESTER@Example.com` (other case) with the
      right password → you're in (emails match ignoring case). The top bar
      shows the app name, Log and History, the version, and a gear.

### Settings (M-SET)

- [ ] **M-SET-01** ★ Gear → Settings shows Account ("Signed in as
      tester@example.com", Change password), Appearance (System / Light /
      Dark), Data (Export CSV, Import CSV), Sign out, and the version.
- [ ] **M-SET-02** ★ Pick **Dark** → the page turns dark at once. Reload →
      still dark. *(Leave it on Dark for the rest of Part 1.)*
- [ ] **M-SET-03** Change password → leave all blank, Save password → "Enter
      your current password."
- [ ] **M-SET-04** Current = your password, new = `short` twice → "The new
      password needs at least 8 characters."
- [ ] **M-SET-05** New and confirm different → "The new passwords don't
      match."
- [ ] **M-SET-06** New = your current password (twice) → "The new password
      must be different from the current one."
- [ ] **M-SET-07** Current = wrong, new = a valid password twice → "Your
      current password is wrong." Cancel. *(The real change is X-08.)*
- [ ] **M-SET-08** Export CSV with no workouts yet → "You have no finished
      workouts to export yet." (no download).

### Import (M-IMP)

- [ ] **M-IMP-01** ★ Import CSV → choose `docs/manual-test-data/seed.csv` →
      preview "Ready to import": 12 entries (one per exercise per workout); 8
      new workouts; Dates: 9/7/26 – 10/9/26; 4 new exercises: Bench Press,
      Pull-up, Row (Pendlay, barbell), Squat; no rows refused. Buttons
      Cancel and "Import 12 entries".
- [ ] **M-IMP-02** Cancel → back to the Import CSV button; nothing imported
      (History still says "No workouts yet").
- [ ] **M-IMP-03** ★ Import `seed.csv` again and confirm → a progress line,
      then "Imported 12 entries: 8 workouts created." → Done.
- [ ] **M-IMP-04** ★ Import `seed-extra.csv` → preview: 2 entries; "1 new
      workout, 1 existing workout added to"; Dates: 10/2/26 – 10/9/26; "1
      new exercise: Overhead Press"; and "6 rows won't be imported":
      - Row 4: Bench Press on 10/9/26 is already logged.
      - Row 5: "13/40/26" isn't a date (use M/D/YY, e.g. 11/10/26).
      - Row 6: 1/1/40 is in the future.
      - Row 7: The exercise name is missing.
      - Row 8: Same exercise and date as row 3.
      - Row 9: Set 1: reps must be a whole number from 0 to 999.
- [ ] **M-IMP-05** Confirm → "Imported 2 entries: 1 workout created, 1
      existing workout added to. 6 rows skipped."
- [ ] **M-IMP-06** Import `seed.csv` a third time → "Nothing to import", 12
      rows refused as already logged, and no import button.

### History, one lift (M-HIST)

Expected values for every lift are in
[the seed tables](#expected-history-after-the-import) below.

- [ ] **M-HIST-01** ★ History opens on **Bench Press** (the lift logged most
      recently): eyebrow "History", title "Bench Press", "5 sessions since
      Sep 7, 2026 · weights in lbs".
- [ ] **M-HIST-02** ★ Four cards across: Latest volume 5,385 "▲ 1,800 (+50%)
      · 10/9" in green; Best volume · PR (the green card) 5,385 "Set on 10/9
      · 175 × 5 × 4"; Heaviest top set 175 × 5 "Up from 155 × 5 in
      September"; Volume PRs 3 of 5 "+28% vs first session".
- [ ] **M-HIST-03** "Volume per session" chart: 5 points evenly spaced, left
      (9/7) to right (10/9); green dots at 9/7, 9/21 and 10/9; about three
      gridlines with round labels.
- [ ] **M-HIST-04** Hover each point → a tip like "9/28 · 3,585" ("· PR" on
      PR points). Moving off the chart hides it.
- [ ] **M-HIST-05** ★ The table, newest first: "October 2026" (1 session ·
      best 5,385 · 1 PR) then "September 2026" (4 sessions · best 5,185 · 2
      PRs); rows 10/9, 9/28, 9/21, 9/14, 9/7 with Top set, Volume (PR cells
      green with a "PR" tag) and Change as in the table below.
- [ ] **M-HIST-06** Sets column, defaults (ramp hidden, grouped): 10/9 reads
      "Ramp 45→95 · 2 sets | 135 × 5 | 175 × 5 ×4", with the 175 chip
      tinted as the top weight. 9/28 shows "137.5 × 4" (decimal kept).
- [ ] **M-HIST-07** Show warm-up ramp on → 10/9 shows 45 × 10 and 95 × 8 as
      their own chips. Group repeated sets off → four separate "175 × 5"
      chips. Reload → both toggles stay as you left them. Set them back
      (ramp off, grouped on).
- [ ] **M-HIST-08** Open the Exercise selector (don't pick anything yet):
      its list is "All exercises", then the five lifts alphabetically. Now
      pick **Squat** → 3 sessions; "Ramp 135 · 1 set" on each
      row; latest 3,805 ▼ 1,320 (−26%) in red.
- [ ] **M-HIST-13** Pick **All exercises**, This month. Nothing is logged
      this month yet, so: the cards read 0 (Workouts, Total volume, PRs "None
      yet", Most improved "—"); the chart card says "No workouts in this
      period yet." instead of drawing empty axes; the table says the same.
      *(If you run this in Sep or Oct 2026, the seed is in the month: skip.)*
- [ ] **M-HIST-09** Pick **Pull-up** (bodyweight, weight 0): volumes 0, no
      PR tags, Volume PRs "0 of 2", 10/7's change "0" with no percentage.
      The second card reads "Best volume" (not green, no "· PR"), "0", "No
      volume PR yet".
- [ ] **M-HIST-10** Pick **Row (Pendlay, barbell)** → the name with its
      comma shows whole; 2 sessions, both PRs.
- [ ] **M-HIST-11** Scroll down the Bench Press table (shrink the window's
      height if needed) → the column header stays pinned under the top bar;
      nothing scrolls sideways.
- [ ] **M-HIST-12** Open `http://localhost:8092/#/metrics` → History opens
      (the old Metrics link).

### Log a workout (M-LOG)

Today has no workout yet.

- [ ] **M-LOG-01** ★ Log → "New workout", today's date, "What are you
      lifting today?", and the exercises alphabetically with their last
      session: Bench Press "Last: Oct 9 · 5,385 lb", Overhead Press "Last:
      Oct 9 · 2,280 lb", Pull-up "Last: Oct 7 · 0 lb", Row (Pendlay,
      barbell) "Last: Oct 7 · 3,480 lb", Squat "Last: Oct 7 · 3,805 lb".
- [ ] **M-LOG-02** Search `bench` → only Bench Press. Search `zzz` → "No
      exercises match “zzz”." Clear the search.
- [ ] **M-LOG-03** Change date → the date picker allows no future date.
      Pick **10/9/26** (has a workout) → that workout opens, labelled
      "Finished", "Fri, Oct 9", tabs Bench Press and Overhead Press.
- [ ] **M-LOG-04** Back to Log (top bar) → New workout for today again.
      Change date to **10/1/26** (no workout) → the header shows "Thu, Oct
      1". Pull-up now says "Last: Sep 9 · 0 lb" (last time *before* that
      date).
- [ ] **M-LOG-05** Tick Pull-up → "Start workout (1)" → a draft for Thu, Oct
      1, prefilled 0 × 10, 0 × 8, 0 × 6, none ticked; "Last time (Sep 9) 0".
- [ ] **M-LOG-06** "•••" → the menu has Change date, Add exercise, Switch
      exercise, History, Settings, Delete workout, but **no** Remove
      exercise (only one exercise).
- [ ] **M-LOG-07** ★ "•••" → Delete workout → "This deletes Thu, Oct 1 and
      its 1 exercise, with all their sets. It can't be undone." → Cancel
      keeps it; Delete workout again → Delete → back to New workout for
      today.
- [ ] **M-LOG-08** New exercise → Add with an empty name → "Enter a name."
      Type `bench press` → Add → no duplicate; Bench Press is ticked.
- [ ] **M-LOG-09** ★ Also tick **Squat** → "Start workout (2)" → Start. Tabs
      Bench Press, Squat (the order picked); a "Finish workout" bar at the
      bottom.
- [ ] **M-LOG-10** ★ Bench Press is prefilled from 10/9: 45×10, 95×8, 135×5,
      175×5 ×4, nothing ticked. Summary: "0 of 20 sets", Lifted 0, "Planned
      5,385", "Last time (Oct 9) 5,385". Group headers "0 / 3,635" (sets
      1–5), "0 / 1,750" (6–10), "0 / 0" (11–15, 16–20).
- [ ] **M-LOG-11** Heavier weights: the weight cells of sets 2, 3 and 4 are
      yellow with a ▲ (each heavier than the set above); sets 1, 5, 6 and 7
      aren't.
- [ ] **M-LOG-12** ★ Tick sets 1–7 → rows tint orange, "7 of 20 sets",
      Lifted 5,385, progress bar moves, group 1 "3,635 / 3,635". The status
      shows "Saving…" then "Saved".
- [ ] **M-LOG-13** ★ Set 7's weight → `185` → a yellow ▲ appears on set 7;
      its Vol 925; Lifted and Planned 5,435. Yellow and ▲ read clearly on
      the orange done row.
Tests M-LOG-14 to M-LOG-16 use sets 8 and 9 as scratch sets. **Leave
them empty** when you're done: anything left in them changes every number
after this.

- [ ] **M-LOG-14** Keyboard: click set 8's weight, type `100`, Enter → reps;
      `5`, Enter → set 9's weight. Clicking a field with a value selects it
      all, so typing replaces it.
- [ ] **M-LOG-15** Set 8's done button is greyed out until both weight and
      reps are filled. Tick it, then clear its reps → it un-ticks. Clear its
      weight too: set 8 is empty again.
- [ ] **M-LOG-16** Bad input in set 9: weight `abc` → "Set 9: Weight must be
      a number."; `2001` → "Weight can be at most 2000 lbs."; `12.345` →
      "Weight can have at most 2 decimals."; reps `5.5` → "Reps must be a
      whole number."; weight `52,5` → accepted as 52.5. Clear set 9's weight
      and reps: set 9 is empty again.
- [ ] **M-LOG-17** ★ Reload the page → everything is still there: 7 sets
      ticked, set 7 at 185, **sets 8 and 9 empty**, Lifted 5,435. *(If not,
      clear them now; later numbers depend on it.)*
- [ ] **M-LOG-18** Squat tab (also with ← → on the focused tab): prefilled
      from 10/7, 135×5, 185×5, 245×3 ×3, "Last time (Oct 7) 3,805". Tick
      sets 1–3 only.
- [ ] **M-LOG-19** ★ "•••" → Add exercise → the picker lists your exercises;
      Bench Press and Squat say "In this workout" and can't be picked. New
      exercise → `  Dumbbell   Curl ` → Add → a third tab "Dumbbell Curl" is
      selected, 20 empty sets, "First time". Enter 30 × 10 in sets 1 and 2
      and tick both (Lifted 600). *(Adding `squat` the same way instead
      says "Squat is already in this workout.")*
- [ ] **M-LOG-20** "•••" → Add exercise → Pull-up → prefilled 0×10, 0×10,
      0×8. "•••" → Switch exercise → title "Switch Pull-up to" → Row (Pendlay,
      barbell) → the tab is renamed and keeps the same sets.
- [ ] **M-LOG-21** "•••" → Remove exercise → "Remove Row (Pendlay,
      barbell)?" → Remove → the tab is gone (three tabs left).
- [ ] **M-LOG-22** "•••" → Change date → a future date → "A workout can't be
      in the future." A date that has a workout (10/9/26) → "You already
      have a workout on Fri, Oct 9." with a link "Open the workout of Fri,
      Oct 9". Pick yesterday → Save → the header shows yesterday. Change it
      back to today.
- [ ] **M-LOG-23** Drafts don't count: History (top bar) → Bench Press
      still has 5 sessions. Log → today's draft opens again.
- [ ] **M-LOG-24** ★ Finish workout → "Finish workout?" "2 sets aren't
      ticked and won't count." → Cancel → still a draft. Finish workout →
      Finish anyway → labelled "Finished", the Finish bar is gone, still
      editable.

### History after the workout (M-ALL)

- [ ] **M-ALL-01** ★ History → Bench Press: "6 sessions since Sep 7, 2026";
      Latest 5,435 "▲ 50 (+1%) · `<today>`"; Best 5,435 "Set on `<today>` ·
      185 × 5"; Heaviest 185 × 5 "Up from 155 × 5 in September"; Volume PRs 4
      of 6 "+29% vs first session". A new month header on top for today's
      month (1 session · best 5,435 · 1 PR), and a sixth chart point
      (green).
- [ ] **M-ALL-02** Squat: 4 sessions; today's row 2,335 ▼ 1,470 (−39%),
      sets "Ramp 135 · 1 set | 185 × 5 | 245 × 3" (the unticked sets aren't
      shown).
- [ ] **M-ALL-03** Dumbbell Curl: 1 session, 600, PR, "— first session".
- [ ] **M-ALL-04** ★ All exercises, **This month**: header "All exercises",
      "`<Month YYYY>` · 3 lifts · weights in lbs"; cards Workouts 1, Total
      volume 8,370, PRs this month 2 ("Bench Press `<today>` · Dumbbell Curl
      `<today>`", green card), Most improved "—" ("Needs two sessions of a
      lift"). The "vs" lines compare with the same days of last month, so
      they depend on the date you run this.
- [ ] **M-ALL-05** "Volume per workout" chart: one bar for today, three
      coloured segments (Bench Press, Squat, Dumbbell Curl), a green dot
      above it. Hover → "`<today>` · Bench Press 5,435 · Squat 2,335 · Dumbbell
      Curl 600 · PR".
- [ ] **M-ALL-06** "Progress by lift" → lines with a dashed 100% line;
      clicking a lift in the legend thickens it and fades the others.
- [ ] **M-ALL-07** "This month by exercise": Bench Press, Dumbbell Curl,
      Squat with colour swatches matching the chart; best sessions of Bench
      Press and Dumbbell Curl green with "PR". Click "Squat" → its one-lift
      view opens.
- [ ] **M-ALL-08** **Last 90 days**: the cards and table now take in the
      seed data. *Run before Dec 6, 2026* (all of it inside the 90 days):
      Workouts 10, Total volume 55,630, Most improved +29% "Bench Press ·
      session volume since 9/7", and six lifts in the table. Later, the
      numbers shrink as the seed ages out.

### Edit a past workout (M-EDIT)

- [ ] **M-EDIT-01** ★ History → Bench Press → click the date **9/28** → the
      Log screen opens "Mon, Sep 28", labelled Finished.
- [ ] **M-EDIT-02** ★ Un-tick set 6 (155 × 5) → wait for "Saved" → History →
      Bench Press: 9/28 is now 2,810 ▼ 2,375 (−46%), and 10/9's change is
      now ▲ 2,575 (+92%).
- [ ] **M-EDIT-03** Open 9/28 again, tick set 6 → History shows 3,585 again
      (back to the seed values).

### Export (M-EXP)

- [ ] **M-EXP-01** ★ Settings → Export CSV → "Exported 17 entries." and a
      file `<app>-export-<today>.csv` downloads.
- [ ] **M-EXP-02** Open it in Numbers (or Google Sheets): a header row
      (Exercise, Date, W1, R1 … W20, R20, Volume); 17 rows sorted by
      exercise, then date; "Row (Pendlay, barbell)" in one cell; Bench Press
      9/28/26 has 137.5 and Volume 3585; today's Squat has only its three
      ticked sets (Volume 2335).
- [ ] **M-EXP-03** Import the exported file → "Nothing to import", 17 rows
      refused as already logged (a clean round trip).

### Connection problems (M-FAIL)

Use Chrome DevTools → Network → throttling **Offline**. Go offline only
after the page has loaded (a reload while offline can't load the app at
all), and back **No throttling** after each test.

- [ ] **M-FAIL-01** On Settings, go offline, then click History → "Couldn't
      load your history. Check your connection and reload."
- [ ] **M-FAIL-02** ★ Open today's workout, go offline, change a weight →
      the status becomes "Not saved yet, retrying…". Go online → "Saved"
      within a few seconds; reload → the change is there. Change it back.
- [ ] **M-FAIL-03** Offline: Settings → Export CSV → "Couldn't export. Check
      your connection and try again."
- [ ] **M-FAIL-04** Offline: Import CSV → choose `seed.csv` → "Couldn't read
      your data to check the file. Check your connection and try again." →
      OK.

### Keyboard and accessibility (M-KEY)

- [ ] **M-KEY-01** On History, press Tab repeatedly → every control (nav,
      selector, toggles, chart, table links) shows a clear focus ring, in a
      sensible order.
- [ ] **M-KEY-02** Focus the Bench Press chart → ← → step through the
      sessions with the tip showing, Home / End jump to the ends, Escape
      hides it.
- [ ] **M-KEY-03** On the Log screen, "•••" opens with Enter and closes
      with Escape; dialogs (Delete workout, Change date) close with Escape.
- [ ] **M-KEY-04** Settings → Light → skim History, Log and Settings for
      anything hard to read, then back to Dark. *(Dark is checked
      throughout Part 1; Light throughout Part 4.)*

### A second user sees nothing (M-ISO)

- [ ] **M-ISO-01** ★ Sign out → sign in as `other@example.com` → History:
      "No workouts yet", with a "Log a workout" link.
- [ ] **M-ISO-02** Log → only "New exercise", with the hint "Add your first
      exercise to start logging. …".
- [ ] **M-ISO-03** Settings → Export CSV → "You have no finished workouts to
      export yet." Sign out, sign back in as `tester@example.com`.

## Part 2 — Admin and accounts, optional (A)

Mac, Chrome. The admin UI is at `http://localhost:8092/_/`.

- [ ] **A-01** In **users**, try creating `Tester@Example.com` → refused
      (emails are unique ignoring case).
- [ ] **A-02** Create `demo@example.com` with **demo** ticked. In a private
      Chrome window, sign in as it → Settings: "This is a demo account. Its
      password can't be changed." and no Change password button.
- [ ] **A-03** As the demo account, pick Light → "Saved on this device
      only." Open the app in another browser profile and sign in as demo →
      its theme is unaffected.
- [ ] **A-04** Forgotten password: in the admin UI, set a new password on
      `other@example.com` → the old one is refused at sign-in, the new one
      works.
- [ ] **A-05** Settings → Application → Rate limits is on (set by a
      migration). *(Go-live also needs the proxy header; see the go-live
      checklist in TODO.md.)*

## Part 3 — Both devices (X)

Mac and iPhone on the same Wi-Fi. On the iPhone, open Chrome at
`http://<your Mac's IP>:8092`.

- [ ] **X-01** ★ On the iPhone, sign in as `tester@example.com` (let the
      keyboard capitalise the first letter) → you're in, in the Dark theme
      chosen on the Mac (it's saved on the account).
- [ ] **X-02** ★ Open today's workout on both (Log), Bench Press tab. On the
      Mac, enter 100 × 5 in set 8 → the iPhone shows it within a second or
      two, with the totals updated.
- [ ] **X-03** On the iPhone, tap set 9's weight and type `110` (keep the
      keypad open). Meanwhile on the Mac, type `90` in set 9's weight → the
      iPhone field isn't replaced while you type. Close the keypad and wait
      a few seconds → both show the same value. Clear sets 8 and 9 on the
      Mac.
- [ ] **X-04** On the Mac, "•••" → Add exercise → Pull-up → a Pull-up tab
      appears on the iPhone. Mac: Remove exercise (Pull-up) → it disappears
      on the iPhone.
- [ ] **X-05** iPhone: History → Overhead Press → tap the 10/2 card → that
      workout opens. Mac: open the same workout (History → Overhead Press →
      10/2).
- [ ] **X-06** Mac: "•••" → Change date → 10/3/26 → the iPhone's header
      changes to "Sat, Oct 3".
- [ ] **X-07** Mac: Delete workout → Delete → the iPhone says "This workout
      was deleted on another device." with a "Back to Log" link. *(Overhead
      Press now has one session.)*
- [ ] **X-08** ★ iPhone: open today's workout. Mac: Settings → Change
      password (to a new one; note it) → "Password changed. Your other
      devices have been signed out." and the Mac stays signed in.
- [ ] **X-09** ★ iPhone: change a weight → after a moment, a "Signed out"
      dialog asks for the password (the screen stays, the status says
      "Signed out, not saved"). A wrong password → an error in the dialog;
      the new password → the dialog closes and the change saves ("Saved").
      Reload on the Mac → the change is there. Change it back.

## Part 4 — iPhone, Chrome (P)

Signed in on the iPhone as `tester@example.com`. Put the Mac away.

### Shell (P-SHELL)

- [ ] **P-SHELL-01** ★ Settings (gear in the header) → **Light**. *(Light
      for the rest of Part 4.)* The tab bar shows Log and History; nothing
      hides under the notch or the home indicator.
- [ ] **P-SHELL-02** Share → Add to Home Screen → the icon is the dumbbell.
      Opening it from the home screen opens Chrome (not a full-screen app).

### History (P-HIST)

- [ ] **P-HIST-01** ★ History → Bench Press: the four cards 2 × 2, then the
      chart, then one card per session, newest first (today at the top),
      with month headers. Nothing scrolls sideways.
- [ ] **P-HIST-02** Tap a chart point → its tip (e.g. "10/9 · 5,385 · PR");
      tap elsewhere → it hides.
- [ ] **P-HIST-03** Session cards: short date with weekday and top set;
      volume with the PR tag and the change under it; set chips wrap inside
      the card and stay readable, decimals like 137.5 included.
- [ ] **P-HIST-04** The two toggles are easy to hit and remember your
      choice after a reload (each device remembers its own).
- [ ] **P-HIST-05** The Exercise selector is full width and opens the iOS
      picker. All exercises → the period switch, 2 × 2 cards, the chart (its
      view switch fits), and a card per lift.
- [ ] **P-HIST-06** ★ Back to Bench Press: tap the 9/28 card → that workout
      opens. Back → the last card clears the tab bar and the home
      indicator.

### Log, finished workout (P-LOG)

- [ ] **P-LOG-01** ★ Log → today's workout, "Finished", with the tab bar.
      Tap a weight → the decimal keypad (with "."); tap a reps field → the
      number keypad. The page doesn't zoom in.
- [ ] **P-LOG-02** Tapping a field with a value selects it, so typing
      replaces it.
- [ ] **P-LOG-03** ★ Room to type: tap set 16's weight → the keypad opens
      and the field stays visible above it, below the pinned column header.
      The tab bar is gone while typing and comes back after you tap
      elsewhere. *(iOS's AutoFill shortcuts above the keypad are expected:
      a web page can't remove them.)*
- [ ] **P-LOG-04** Scroll the sets → the header row (Set, Lbs, Reps, Vol,
      Done) stays pinned. Done buttons are easy to hit; yellow ▲ cells read
      clearly in Light, on ticked and unticked rows.
- [ ] **P-LOG-05** Type a value, switch to another app and back → nothing
      lost; "Saved" shows.
- [ ] **P-LOG-06** "•••" → Change date opens the native date picker (no
      future dates). Cancel. Add exercise: the list scrolls inside the
      dialog, and the keyboard doesn't open until you tap Search or New
      exercise. Cancel.
- [ ] **P-LOG-07** ★ "•••" → Delete workout → the dialog's buttons are easy
      to hit → Delete → New workout for today. *(This removes today's
      workout so the next tests can start a draft.)*

### Start and finish a draft (P-NEW)

- [ ] **P-NEW-01** ★ New workout: Change date opens the native date picker
      (no future dates); keep today. Tick Bench Press → the tab bar gives way
      to "Start workout (1)", above the home indicator, never covering the
      last exercise.
- [ ] **P-NEW-02** Start → the draft with the "Finish workout" bar above
      the home indicator, not covering set 20 when scrolled to the bottom.
- [ ] **P-NEW-03** ★ Tap set 16's weight → the Finish bar steps aside while
      typing and returns after.
- [ ] **P-NEW-04** Tick sets 1–6, leave set 7 → Finish workout → "1 set
      isn't ticked and won't count." → Finish anyway → "Finished", the tab bar
      returns.
- [ ] **P-NEW-05** Settings → Import CSV opens the Files picker; Cancel.
      Export CSV saves the file (Chrome: Downloads, in the Files app).
- [ ] **P-NEW-06** ★ Both themes are comfortable to read in a dim room
      (switch to Dark and skim Log and History once).

### Finish the run

- [ ] Stop PocketBase (Ctrl+C). To return to your own data:
      `rm -rf pb_data && mv ../ironbook-pb_data.before-test-<date> pb_data`.
- [ ] Fill in the run log below.

## Expected History after the import

Volumes in lbs; ▲/▼ is the change vs the previous session; "PR" a volume
PR. Before Part 1's workout (M-LOG), with `seed.csv` and `seed-extra.csv`.

**Bench Press** — 5 sessions since Sep 7, 2026; ramp 45→95 on every
session.

| Date | Sets (default view) | Top set | Volume | Change |
| --- | --- | --- | --- | --- |
| 10/9 | Ramp 45→95 · 2 sets, 135 × 5, 175 × 5 ×4 | 175 × 5 | 5,385 PR | ▲ 1,800 +50% |
| 9/28 | Ramp 45→95 · 2 sets, 137.5 × 4, 175 × 3 ×2, 155 × 5 | 175 × 3 | 3,585 | ▼ 1,600 −31% |
| 9/21 | Ramp 45→95 · 2 sets, 135 × 5, 165 × 5 ×4 | 165 × 5 | 5,185 PR | ▲ 1,155 +29% |
| 9/14 | Ramp 45→95 · 2 sets, 135 × 5, 165 × 5 ×2, 165 × 3 | 165 × 5 | 4,030 | ▼ 180 −4% |
| 9/7 | Ramp 45→95 · 2 sets, 135 × 5, 155 × 5 ×3 | 155 × 5 | 4,210 PR | — first session |

**Squat** — 3 sessions since Sep 9, 2026. Cards: Latest 3,805 ▼ 1,320
(−26%); Best 5,125 "Set on 9/23 · 235 × 5 × 3"; Heaviest 245 × 3 "Up from
225 × 5 in September"; PRs 2 of 3 "−24% vs first session".

| Date | Sets | Volume | Change |
| --- | --- | --- | --- |
| 10/7 | Ramp 135 · 1 set, 185 × 5, 245 × 3 ×3 | 3,805 | ▼ 1,320 −26% |
| 9/23 | Ramp 135 · 1 set, 185 × 5, 235 × 5 ×3 | 5,125 PR | ▲ 150 +3% |
| 9/9 | Ramp 135 · 1 set, 185 × 5, 225 × 5 ×3 | 4,975 PR | — first session |

**Row (Pendlay, barbell)** — 10/7: 145 × 8 ×3, 3,480 PR ▲ 240 +7%; 9/9:
135 × 8 ×3, 3,240 PR, first session. Cards: PRs 2 of 2, "+7% vs first
session".

**Pull-up** (bodyweight) — 10/7: 0 × 10 ×2, 0 × 8, volume 0, change 0;
9/9: 0 × 10, 0 × 8, 0 × 6, volume 0, first session. No PRs (a PR needs
volume above 0); Volume PRs "0 of 2".

**Overhead Press** (from `seed-extra.csv`) — 10/9: 95 × 8 ×3, 2,280 PR
▲ 320 +16%; 10/2: 95 × 8, 100 × 6 ×2, 1,960 PR, first session.

**The workout logged in M-LOG** (today): Bench Press 45×10, 95×8, 135×5,
175×5 ×3, 185×5, all ticked = 5,435 (a PR: 5,385 would only have tied, and
ties aren't PRs); Squat 135×5, 185×5, 245×3 ticked, two sets unticked =
2,335; Dumbbell Curl 30×10 ×2 = 600. Total 8,370.

## Covered by automated tests only

Not worth doing by hand (each has E2E or integration tests): the 20-exercise
limit per workout, the import stopping part-way on a dropped connection,
time zones around midnight, a session ending mid-save on the Log screen's
every action, migrations up and down, rate limits under production
settings, one user reading another's data through the API, and an exercise
name containing HTML.

## Keeping this plan current

- A pull request that changes what a screen shows or does updates the
  tests here in the same PR: edit the affected tests, add new ones with the
  next free ID in their area, and retire removed ones (strike them through
  and keep the ID, e.g. `~~M-LOG-05~~ retired 2026-12-01: …`).
- If the seed data changes, recompute the expected numbers with the app's
  own calculations (the History and import functions in `src/lib/`), not by
  hand.
- A run that finds a bug: note the IDs in the run log, fix it in its own
  PR, then rerun those tests (and the smoke set).

## Run log

| Date | Version | Scope | Result | Problems (IDs) |
| --- | --- | --- | --- | --- |
| | | Full / Smoke / Partial | | |

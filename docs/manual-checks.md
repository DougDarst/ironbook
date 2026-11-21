# Manual checks on a real iPhone

Automated tests run in emulated iPhone WebKit, which can't show the real
keyboard, the native date picker, safe areas, or how it feels to use. Run
these on a real iPhone (Chrome) after each story that changes a screen, and
note the date and result in the pull request.

Last run: 2026-11-16, Log screen, all checks passed.

Set up: run `npm run build && npm run pb:serve` on your Mac, then open
`http://<your Mac's local IP>:8092` on the iPhone (same Wi-Fi). PocketBase
must listen on all interfaces for this: `./pocketbase serve --http
0.0.0.0:8092 --automigrate=false` (local network only; stop it afterwards).

## Log screen (Stories 11–12)

- [ ] Tapping a weight or reps field opens the number keypad (iOS shows the
      same pad, with a ".", for both).
- [ ] Tapping a field with a value selects it, so typing replaces it.
- [ ] (No Next check: iPhone's number pad has no Next or Return key, and
      iOS no longer shows field arrows above it. Fields are tapped. Next/Enter
      works with a hardware keyboard and is covered by the E2E tests.)
- [ ] The page doesn't zoom in when a field is focused.
- [ ] The column header (Set, Lbs, Reps, Vol, Done) stays pinned while
      scrolling the sets.
- [ ] The done button is easy to hit (44 px) and greyed out until weight and
      reps are filled.
- [ ] Totals (Lifted, planned, group headers) update as you type and tick.
- [ ] "Saving…" then "Saved" shows after a pause in typing; reloading shows
      what you typed.
- [ ] Switch to another app mid-entry and back: nothing typed is lost.
- [ ] With the same workout open on a second device, a change there appears
      here within a second or two, and never replaces the field you're typing
      in.
- [ ] Nothing hides under the notch or the home indicator; the "•••" menu
      opens and leads to History and Settings.
- [ ] Both themes are comfortable to read in a dim gym.

## Room to type (2026-11-20)

- [ ] Tap a weight near the bottom (e.g. set 16): the number pad opens and
      the field stays visible above it, below the column header.
- [ ] While typing, the tab bar (finished workout) or Finish bar (draft)
      is gone; tapping elsewhere brings it back.

## Finish and delete (Story 13)

- [ ] The Finish workout bar sits above the home indicator and never covers
      the last set.
- [ ] With an un-ticked set, Finish asks first; Cancel and the dialog's
      buttons are easy to hit.
- [ ] After Finish, the tab bar comes back and the screen says Finished.
- [ ] Delete workout (in "•••") asks first, then returns to the picker.

Known iOS behavior, not a bug: the keypad shows iOS's AutoFill shortcuts
(key, card, location). iOS adds them to every numeric field whatever the
page asks; only a full letter keyboard avoids them (tested 2026-11-16).

## History set chips (redesign, Story 2)

- [ ] On iPhone, chips wrap inside the card and stay readable; the two
      toggles are easy to hit and remember your choice.

## Import (Story 21)

- [ ] Settings › Import CSV opens the file picker (Files on iPhone); the
      preview and its buttons fit the screen.

## Export (Story 20)

- [ ] Settings › Export CSV saves the file (Chrome on iPhone: Downloads,
      in the Files app), and it opens in Numbers or Google Sheets with one
      row per exercise per workout.

## Edit a workout (Story 16)

- [ ] "•••" → Change date opens the native date picker; future dates can't
      be picked.
- [ ] Add / Switch exercise: the list scrolls inside the dialog, the
      keyboard doesn't open until you tap Search or New exercise, and the
      dialog's buttons are easy to hit.
- [ ] After Add, the new exercise's tab is selected and in view.

## History cards (Story 15)

- [ ] History shows cards, not the wide grid; nothing scrolls sideways.
- [ ] Five sets fit on each row, including decimal weights like 202.5×5.
- [ ] Tapping anywhere on a card opens that workout.
- [ ] The last card clears the tab bar and the home indicator.
- [ ] Both themes are easy to read; the PR badge stands out.

## Choose exercises (Story 10)

- [ ] "Change date" opens the native date picker; future dates can't be
      picked.
- [ ] The Start workout bar sits above the home indicator and never covers
      the last card.

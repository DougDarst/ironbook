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
      opens and leads to History, Metrics and Settings.
- [ ] Both themes are comfortable to read in a dim gym.

Known iOS behavior, not a bug: the keypad shows iOS's AutoFill shortcuts
(key, card, location). iOS adds them to every numeric field whatever the
page asks; only a full letter keyboard avoids them (tested 2026-11-16).

## Choose exercises (Story 10)

- [ ] "Change date" opens the native date picker; future dates can't be
      picked.
- [ ] The Start workout bar sits above the home indicator and never covers
      the last card.

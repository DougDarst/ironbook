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

## Planned
- Bump `VERSION` to 1.0 in `src/lib/config.ts` when the Google Sheet is
  retired (Story 22).
- Deploy script refuses to deploy a dirty working tree (Story 4).

## Later (v2 and beyond)
- Integrations: Strava, Apple Health.
- Heaviest-weight PR.
- Renaming an exercise everywhere at once (v1 only moves a single entry to
  another exercise).
- Highlighting of individual weight/rep cells in History (e.g. more reps
  than last time).
- More metrics.

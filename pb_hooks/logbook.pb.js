/// <reference path="../pb_data/types.d.ts" />

/**
 * Validation and housekeeping for the logbook collections that API rules
 * can't express. These are model hooks, so they apply to every write: API
 * requests, batch requests and the admin UI.
 *
 * - Checks run in onRecordValidate: a BadRequestError thrown there reaches
 *   the client with its message and field. (Thrown from onRecordCreate or
 *   onRecordUpdate, PocketBase replaces it with a generic error.)
 * - Housekeeping that never fails (normalizing names, finished_at) runs in
 *   onRecordCreate / onRecordUpdate, before validation.
 *
 * The checks are shared with the app (src/lib/model/), bundled into
 * generated/shared.cjs by `npm run build:hooks`. Each handler runs in its
 * own JS context (top-level helpers aren't visible inside it), so handlers
 * are self-contained and `require` the bundle themselves.
 */

// --- Exercises: names stored trimmed, whitespace collapsed (uniqueness
// ignoring case is a database index).

function normalizeName(e) {
  const { normalizeExerciseName } = require(`${__hooks}/generated/shared.cjs`);
  e.record.set('name', normalizeExerciseName(e.record.get('name')));
  e.next();
}
onRecordCreate(normalizeName, 'exercises');
onRecordUpdate(normalizeName, 'exercises');

// --- Workouts: a real calendar date; finished_at set when a workout
// becomes finished, kept while it stays finished, cleared for drafts.

function stampFinished(e) {
  const finished = e.record.get('status') === 'finished';
  const before = e.record.isNew() ? null : e.record.original();
  if (!finished) e.record.set('finished_at', '');
  else if (before && before.get('status') === 'finished') e.record.set('finished_at', before.get('finished_at'));
  else e.record.set('finished_at', new DateTime());
  e.next();
}
onRecordCreate(stampFinished, 'workouts');
onRecordUpdate(stampFinished, 'workouts');

onRecordValidate((e) => {
  const { isValidDate } = require(`${__hooks}/generated/shared.cjs`);
  if (!isValidDate(e.record.get('date'))) {
    throw new BadRequestError('Date must be a real date as YYYY-MM-DD.', {
      date: new ValidationError('invalid_date', 'Date must be a real date as YYYY-MM-DD.'),
    });
  }
  e.next();
}, 'workouts');

// --- Entries: the 20-slot sets shape; the workout and exercise must belong
// to the entry's user; an entry may switch exercise but never workout; a
// workout holds at most MAX_EXERCISES_PER_WORKOUT entries.

onRecordValidate((e) => {
  const { MAX_EXERCISES_PER_WORKOUT, validateSets } = require(`${__hooks}/generated/shared.cjs`);
  const fail = (field, message) => {
    throw new BadRequestError(message, { [field]: new ValidationError('invalid_' + field, message) });
  };

  // A JSON field comes back as raw bytes in hooks; read it as text and parse.
  let parsed;
  try {
    parsed = JSON.parse(e.record.getString('sets') || 'null');
  } catch (_) {
    parsed = undefined;
  }
  const problem = validateSets(parsed);
  if (problem) fail('sets', problem);

  const user = e.record.get('user');
  for (const [field, collection] of [
    ['workout', 'workouts'],
    ['exercise', 'exercises'],
  ]) {
    let owner = '';
    try {
      owner = e.app.findRecordById(collection, e.record.get(field)).get('user');
    } catch (_) {
      // Missing: PocketBase's own relation check reports it.
    }
    if (owner && owner !== user) fail(field, `That ${field} belongs to someone else.`);
  }

  if (!e.record.isNew() && e.record.get('workout') !== e.record.original().get('workout')) {
    fail('workout', "An entry can't move to another workout.");
  }

  // Counted through e.app, which sees earlier creates in the same batch.
  if (e.record.isNew()) {
    const existing = e.app.countRecords('entries', $dbx.hashExp({ workout: e.record.get('workout') }));
    if (existing >= MAX_EXERCISES_PER_WORKOUT) {
      fail('workout', `A workout can have at most ${MAX_EXERCISES_PER_WORKOUT} exercises.`);
    }
  }
  e.next();
}, 'entries');

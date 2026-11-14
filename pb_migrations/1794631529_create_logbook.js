/// <reference path="../pb_data/types.d.ts" />

/**
 * The logbook: exercises, workouts, and entries (one exercise within one
 * workout, with its 20 set slots as JSON). See docs/spec.md › Data model.
 *
 * Every record belongs to one user. API rules limit every operation to the
 * owner, and nobody can change a record's `user`. Validation that rules
 * can't express (dates, the sets shape, cross-record ownership, name
 * normalization) lives in pb_hooks/logbook.pb.js.
 *
 * Deleting a user deletes their data; deleting a workout deletes its
 * entries; an exercise that any entry uses can't be deleted.
 */

const OWNER = 'user = @request.auth.id';
const CREATE = '@request.auth.id != "" && user = @request.auth.id';
const UPDATE = 'user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)';

function ownedRules() {
  return { listRule: OWNER, viewRule: OWNER, createRule: CREATE, updateRule: UPDATE, deleteRule: OWNER };
}

function userField(users) {
  return { name: 'user', type: 'relation', collectionId: users.id, required: true, maxSelect: 1, cascadeDelete: true };
}

function timestamps() {
  return [
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ];
}

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    const exercises = new Collection({
      type: 'base',
      name: 'exercises',
      ...ownedRules(),
      fields: [userField(users), { name: 'name', type: 'text', required: true, max: 100, presentable: true }, ...timestamps()],
      // Names are unique per user, ignoring case.
      indexes: ['CREATE UNIQUE INDEX idx_exercises_user_name ON exercises (user, name COLLATE NOCASE)'],
    });
    app.save(exercises);

    const workouts = new Collection({
      type: 'base',
      name: 'workouts',
      ...ownedRules(),
      fields: [
        userField(users),
        // Date-only "YYYY-MM-DD" text, never a timestamp (the hook checks it's a real date).
        { name: 'date', type: 'text', required: true, pattern: '^\\d{4}-\\d{2}-\\d{2}$', presentable: true },
        { name: 'status', type: 'select', required: true, values: ['draft', 'finished'], maxSelect: 1 },
        { name: 'finished_at', type: 'date' },
        ...timestamps(),
      ],
      indexes: [
        // One workout per user per date.
        'CREATE UNIQUE INDEX idx_workouts_user_date ON workouts (user, date)',
        'CREATE INDEX idx_workouts_user_status_date ON workouts (user, status, date)',
      ],
    });
    app.save(workouts);

    const entries = new Collection({
      type: 'base',
      name: 'entries',
      ...ownedRules(),
      fields: [
        userField(users),
        { name: 'workout', type: 'relation', collectionId: workouts.id, required: true, maxSelect: 1, cascadeDelete: true },
        { name: 'exercise', type: 'relation', collectionId: exercises.id, required: true, maxSelect: 1, cascadeDelete: false },
        // Order within the workout, from 0. (Not "required": PocketBase treats 0 as blank.)
        { name: 'position', type: 'number', min: 0, onlyInt: true },
        // Exactly 20 {weight, reps, done} slots (validated by the hook).
        { name: 'sets', type: 'json', required: true, maxSize: 10000 },
        ...timestamps(),
      ],
      indexes: [
        // An exercise appears at most once per workout.
        'CREATE UNIQUE INDEX idx_entries_workout_exercise ON entries (workout, exercise)',
        'CREATE INDEX idx_entries_user_exercise ON entries (user, exercise)',
      ],
    });
    app.save(entries);

    // The batch API (off by default) lets the app create a workout and all
    // its entries in one all-or-nothing request.
    const settings = app.settings();
    settings.batch.enabled = true;
    app.save(settings);
  },
  (app) => {
    for (const name of ['entries', 'workouts', 'exercises']) {
      app.delete(app.findCollectionByNameOrId(name));
    }
    const settings = app.settings();
    settings.batch.enabled = false;
    app.save(settings);
  },
);

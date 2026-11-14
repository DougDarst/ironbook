/// <reference path="../pb_data/types.d.ts" />

/**
 * The user's theme preference, chosen in Settings. Empty means "system"
 * (follow the device), which is the default for every account.
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.fields.add(new SelectField({ name: 'theme', values: ['system', 'light', 'dark'], maxSelect: 1 }));
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.fields.removeByName('theme');
    app.save(users);
  },
);

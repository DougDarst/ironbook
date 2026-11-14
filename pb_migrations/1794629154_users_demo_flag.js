/// <reference path="../pb_data/types.d.ts" />

/**
 * Demo accounts: ordinary password accounts that the owner creates and hands
 * out, marked with the `demo` checkbox in the admin UI. Visitors share them,
 * so a demo account can't change its own user record (name, password,
 * anything), and only the superuser can set or clear `demo`.
 */
const LOCKED_UPDATE_RULE = 'id = @request.auth.id && demo = false && @request.body.demo:isset = false';
const PREVIOUS_UPDATE_RULE = 'id = @request.auth.id';

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.fields.add(new BoolField({ name: 'demo' }));
    users.updateRule = LOCKED_UPDATE_RULE;
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.fields.removeByName('demo');
    users.updateRule = PREVIOUS_UPDATE_RULE;
    app.save(users);
  },
);

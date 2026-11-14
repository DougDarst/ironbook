/// <reference path="../pb_data/types.d.ts" />

/**
 * Users sign in with email and password. There's no public sign-up: the
 * superuser creates every account in the admin UI, which is the invite.
 *
 * - create and delete: superuser only (null rules).
 * - list/view/update: your own record only. (PocketBase itself requires the
 *   old password to change a password, and refuses email changes here.)
 * - OAuth2, OTP and MFA are off.
 * - Emails are unique ignoring case, so sign-in can match them ignoring case
 *   (pb_hooks/auth.pb.js).
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    unmarshal(
      {
        listRule: 'id = @request.auth.id',
        viewRule: 'id = @request.auth.id',
        createRule: null,
        updateRule: 'id = @request.auth.id',
        deleteRule: null,
        passwordAuth: { enabled: true, identityFields: ['email'] },
        oauth2: { enabled: false },
        otp: { enabled: false },
        mfa: { enabled: false },
      },
      users,
    );
    users.addIndex('idx_users_email_nocase', true, 'email COLLATE NOCASE', "email != ''");
    app.save(users);
  },
  (app) => {
    // Back to PocketBase's defaults for a new app.
    const users = app.findCollectionByNameOrId('users');
    unmarshal(
      {
        listRule: 'id = @request.auth.id',
        viewRule: 'id = @request.auth.id',
        createRule: '',
        updateRule: 'id = @request.auth.id',
        deleteRule: 'id = @request.auth.id',
      },
      users,
    );
    users.removeIndex('idx_users_email_nocase');
    app.save(users);
  },
);

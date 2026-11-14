/// <reference path="../pb_data/types.d.ts" />

/**
 * Sign-in ignores the case of the email. PocketBase matches the identity
 * exactly, so "Me@example.com" (an iPhone capitalizing the first letter, or
 * an account created with capitals) wouldn't find "me@example.com". When the
 * exact match fails, look the account up ignoring case; the password is
 * still checked by PocketBase as usual. Emails are unique ignoring case (see
 * the users migration), so this finds at most one account.
 */
onRecordAuthWithPasswordRequest((e) => {
  if (!e.record && e.identity) {
    try {
      e.record = e.app.findFirstRecordByFilter(e.collection, 'email:lower = {:email}', {
        email: String(e.identity).trim().toLowerCase(),
      });
    } catch (_) {
      // No such account: PocketBase answers as for a wrong password.
    }
  }
  e.next();
}, 'users');

import { describe, expect, it } from 'vitest';
import {
  checkNewPassword,
  endsSession,
  normalizeEmail,
  OFFLINE,
  passwordChangeErrorMessage,
  SIGN_IN_FAILED,
  signInErrorMessage,
  TOO_MANY_ATTEMPTS,
  WRONG_CREDENTIALS,
} from './auth';

describe('signInErrorMessage', () => {
  it('says the email and password do not match on 400', () => {
    expect(signInErrorMessage({ status: 400 })).toBe(WRONG_CREDENTIALS);
  });

  it('asks to wait when rate-limited', () => {
    expect(signInErrorMessage({ status: 429 })).toBe(TOO_MANY_ATTEMPTS);
  });

  it('says nothing when the request was cancelled', () => {
    expect(signInErrorMessage({ status: 0, isAbort: true })).toBeNull();
  });

  it('blames the connection when the server is unreachable', () => {
    expect(signInErrorMessage({ status: 0 })).toBe(OFFLINE);
    expect(signInErrorMessage(new Error('boom'))).toBe(OFFLINE);
  });

  it('gives a generic retry message for other errors', () => {
    expect(signInErrorMessage({ status: 403 })).toBe(SIGN_IN_FAILED);
    expect(signInErrorMessage({ status: 500 })).toBe(SIGN_IN_FAILED);
  });
});

describe('endsSession', () => {
  it('ends the session when the server rejects it', () => {
    expect(endsSession({ status: 401 })).toBe(true);
    expect(endsSession({ status: 403 })).toBe(true);
    expect(endsSession({ status: 404 })).toBe(true); // account deleted
  });

  it('keeps the session through network and server errors', () => {
    expect(endsSession({ status: 0 })).toBe(false);
    expect(endsSession({ status: 500 })).toBe(false);
    expect(endsSession(undefined)).toBe(false);
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Me@Example.COM ')).toBe('me@example.com');
  });
});

describe('checkNewPassword', () => {
  it('accepts a valid change', () => {
    expect(checkNewPassword('old-password', 'new-password', 'new-password')).toBeNull();
  });

  it('requires the current password', () => {
    expect(checkNewPassword('', 'new-password', 'new-password')).toBe('Enter your current password.');
  });

  it('requires at least 8 characters, counting exactly', () => {
    expect(checkNewPassword('old-password', '1234567', '1234567')).toMatch(/at least 8 characters/);
    expect(checkNewPassword('old-password', '12345678', '12345678')).toBeNull();
  });

  it('requires the confirmation to match', () => {
    expect(checkNewPassword('old-password', 'new-password', 'new-passwore')).toBe("The new passwords don't match.");
  });

  it('requires a different password', () => {
    expect(checkNewPassword('same-password', 'same-password', 'same-password')).toMatch(/must be different/);
  });
});

describe('passwordChangeErrorMessage', () => {
  // Shapes as PocketBase 0.40 returns them.
  const fieldError = (field: string, message: string) => ({
    status: 400,
    response: { data: { [field]: { code: 'x', message } } },
  });

  it('says the current password is wrong', () => {
    expect(passwordChangeErrorMessage(fieldError('oldPassword', 'Missing or invalid old password.'))).toBe(
      'Your current password is wrong.',
    );
  });

  it('passes on what the server says about the new password', () => {
    expect(passwordChangeErrorMessage(fieldError('password', 'Must be at least 8 character(s).'))).toBe(
      'New password: Must be at least 8 character(s).',
    );
  });

  it('reports a mismatched confirmation', () => {
    expect(passwordChangeErrorMessage(fieldError('passwordConfirm', "Values don't match."))).toBe(
      "The new passwords don't match.",
    );
  });

  it('handles rate limits, the network and anything else', () => {
    expect(passwordChangeErrorMessage({ status: 429 })).toBe(TOO_MANY_ATTEMPTS);
    expect(passwordChangeErrorMessage({ status: 0 })).toBe(OFFLINE);
    expect(passwordChangeErrorMessage({ status: 500 })).toMatch(/Couldn't change the password/);
  });
});

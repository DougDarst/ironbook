import { describe, expect, it } from 'vitest';
import {
  endsSession,
  normalizeEmail,
  OFFLINE,
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

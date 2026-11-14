/**
 * Sign-in helpers. Pure functions, unit-tested in auth.test.ts.
 */

/** The shape of a PocketBase SDK error that these helpers look at. */
export interface AuthError {
  status?: number;
  isAbort?: boolean;
}

export const WRONG_CREDENTIALS = "That email and password don't match.";
export const TOO_MANY_ATTEMPTS = 'Too many attempts. Wait a few seconds and try again.';
export const OFFLINE = "Couldn't reach the server. Check your connection and try again.";
export const SIGN_IN_FAILED = "Sign-in didn't work. Please try again.";

/** The message to show when signing in fails, or null if it was cancelled. */
export function signInErrorMessage(err: unknown): string | null {
  const e = (err ?? {}) as AuthError;
  if (e.isAbort) return null;
  // PocketBase answers 400 both for a wrong password and an unknown email,
  // so the message doesn't reveal which accounts exist.
  if (e.status === 400) return WRONG_CREDENTIALS;
  if (e.status === 429) return TOO_MANY_ATTEMPTS;
  if (e.status === 0 || e.status === undefined) return OFFLINE;
  return SIGN_IN_FAILED;
}

/**
 * Whether a failed session refresh means the session is over (sign the user
 * out), as opposed to a passing problem like a network error (keep it).
 */
export function endsSession(err: unknown): boolean {
  const status = ((err ?? {}) as AuthError).status;
  return status === 401 || status === 403 || status === 404;
}

/** Emails are matched ignoring case; trim stray spaces from autofill. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

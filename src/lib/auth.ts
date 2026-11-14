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

/** PocketBase's minimum password length for auth collections. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Checks a change-password form before sending it. Returns the message to
 * show, or null if it looks fine.
 */
export function checkNewPassword(current: string, next: string, confirm: string): string | null {
  if (!current) return 'Enter your current password.';
  if (next.length < MIN_PASSWORD_LENGTH) return `The new password needs at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (next !== confirm) return "The new passwords don't match.";
  if (next === current) return 'The new password must be different from the current one.';
  return null;
}

/** The message to show when the server refuses a password change. */
export function passwordChangeErrorMessage(err: unknown): string {
  const e = (err ?? {}) as AuthError & { response?: { data?: Record<string, { message?: string }> } };
  const fields = e.response?.data ?? {};
  if (fields.oldPassword) return 'Your current password is wrong.';
  if (fields.passwordConfirm) return "The new passwords don't match.";
  if (fields.password?.message) return `New password: ${fields.password.message}`;
  if (e.status === 429) return TOO_MANY_ATTEMPTS;
  if (e.status === 0 || e.status === undefined) return OFFLINE;
  return "Couldn't change the password. Please try again.";
}

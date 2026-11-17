import type { RecordModel } from 'pocketbase';
import { endsSession, normalizeEmail, signInErrorMessage } from '../auth';
import { pb } from '../pb';

/**
 * The signed-in user. Sign-in is email and password; accounts are created
 * by the owner (superuser) in the admin UI.
 */
class Session {
  user = $state<RecordModel | null>(pb.authStore.isValid ? pb.authStore.record : null);
  /** Shown on the sign-in screen, e.g. a wrong password. */
  notice = $state<string | null>(null);
  signingIn = $state(false);
  /**
   * The server ended the session while the app was open (e.g. the password
   * was changed on another device). The screen stays, with anything not yet
   * saved, until the user signs in again (see ReauthDialog).
   */
  expired = $state(false);
  #checking: Promise<void> | null = null;

  constructor() {
    pb.authStore.onChange(() => {
      this.user = pb.authStore.isValid ? pb.authStore.record : null;
    });
  }

  /**
   * Refreshes the session on load. If the server rejects it (e.g. the
   * account was deleted), the user is signed out. Network errors keep the
   * session.
   */
  async refresh(): Promise<void> {
    if (!pb.authStore.isValid) return;
    try {
      await pb.collection('users').authRefresh();
    } catch (err) {
      if (endsSession(err)) pb.authStore.clear();
    }
  }

  /**
   * Checks the session is still alive, after a failed save or when the app
   * comes back to the foreground. The server treats an ended session as a
   * guest (saves are refused as "not found", lists come back empty), so only
   * a refresh tells. If it has ended, sets `expired`; network errors don't.
   */
  check(): Promise<void> {
    if (!this.user || this.expired) return Promise.resolve();
    this.#checking ??= pb
      .collection('users')
      .authRefresh()
      .then(
        () => undefined,
        (err) => {
          if (endsSession(err)) this.expired = true;
        },
      )
      .finally(() => (this.#checking = null));
    return this.#checking;
  }

  /** Signs in again as the same user after the session ended; on failure sets `notice`. */
  async resume(password: string): Promise<boolean> {
    const email = this.user?.email as string | undefined;
    if (!email) return false;
    const ok = await this.signIn(email, password);
    if (ok) this.expired = false;
    return ok;
  }

  /** Signs out of this device and returns to the default screen. */
  signOut(): void {
    pb.authStore.clear();
    this.expired = false;
    this.notice = null;
    window.location.hash = '#/';
  }

  /**
   * Changes the signed-in user's password. PocketBase then ends every
   * session for the account (other devices are signed out), so this signs
   * back in on this device with the new password. Throws the server's error.
   */
  async changePassword(current: string, next: string): Promise<void> {
    const user = pb.authStore.record;
    if (!user) throw new Error('Not signed in');
    await pb.collection('users').update(user.id, {
      oldPassword: current,
      password: next,
      passwordConfirm: next,
    });
    await pb.collection('users').authWithPassword(user.email, next);
  }

  /** Signs in; on failure sets `notice` and returns false. */
  async signIn(email: string, password: string): Promise<boolean> {
    this.notice = null;
    this.signingIn = true;
    try {
      await pb.collection('users').authWithPassword(normalizeEmail(email), password);
      return true;
    } catch (err) {
      this.notice = signInErrorMessage(err);
      return false;
    } finally {
      this.signingIn = false;
    }
  }
}

export const session = new Session();

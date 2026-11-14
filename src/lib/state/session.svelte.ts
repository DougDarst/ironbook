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

  /** Signs out of this device and returns to the default screen. */
  signOut(): void {
    pb.authStore.clear();
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

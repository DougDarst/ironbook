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

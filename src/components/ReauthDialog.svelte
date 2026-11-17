<script lang="ts">
  import { session } from '../lib/state/session.svelte';

  /**
   * Shown when the session ends while the app is open (e.g. the password was
   * changed on another device). The screen behind stays as it is, so nothing
   * typed is lost; signing in again lets it save.
   */
  let dialog: HTMLDialogElement | undefined = $state();
  let password = $state('');
  let passwordInput: HTMLInputElement | undefined = $state();
  const open = $derived(Boolean(session.user) && session.expired);

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      password = '';
      session.notice = null;
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!(await session.resume(password))) {
      password = '';
      passwordInput?.focus();
    }
  }
</script>

<dialog
  bind:this={dialog}
  class="card"
  aria-labelledby="reauth-title"
  aria-describedby="reauth-message"
  oncancel={(e) => e.preventDefault()}
>
  <form onsubmit={submit}>
    <h2 id="reauth-title" class="title">Signed out</h2>
    <p id="reauth-message">
      Your session ended, for example because your password was changed on another device. Sign in again to save
      your changes.
    </p>
    {#if session.notice}
      <p class="notice" role="alert">{session.notice}</p>
    {/if}
    <p class="muted small">Signed in as {session.user?.email}</p>
    <label class="field">
      <span class="label">Password</span>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        type="password"
        autocomplete="current-password"
        required
        autofocus
        bind:value={password}
        bind:this={passwordInput}
      />
    </label>
    <button type="submit" class="button-primary" disabled={session.signingIn}>
      {session.signingIn ? 'Signing in…' : 'Sign in'}
    </button>
    <button type="button" class="button-secondary" onclick={() => session.signOut()}>
      Sign out (changes not saved yet are lost)
    </button>
  </form>
</dialog>

<style>
  dialog {
    width: min(400px, calc(100vw - 2 * var(--space-4)));
    padding: var(--space-6) var(--space-4) var(--space-4);
    color: var(--ink);
  }

  dialog::backdrop {
    background: rgb(0 0 0 / 0.5);
  }

  form,
  .field {
    display: grid;
    gap: var(--space-3);
  }

  .field {
    gap: var(--space-2);
  }

  h2,
  p {
    margin: 0;
  }

  input {
    width: 100%;
    min-height: var(--tap);
    padding: 0 var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: var(--raised);
    font-size: 16px;
  }

  .button-secondary {
    white-space: normal;
  }

  button:disabled {
    opacity: 0.7;
    cursor: progress;
  }
</style>

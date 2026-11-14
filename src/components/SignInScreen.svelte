<script lang="ts">
  import { APP } from '../lib/config';
  import { session } from '../lib/state/session.svelte';

  let email = $state('');
  let password = $state('');
  let passwordInput: HTMLInputElement | undefined = $state();

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const ok = await session.signIn(email, password);
    if (!ok) {
      password = '';
      passwordInput?.focus();
    }
  }
</script>

<main class="sign-in">
  <h1 class="display brand">{APP.name}</h1>
  <p class="tagline muted">Your lifting logbook.</p>

  <form class="card" aria-labelledby="sign-in-title" onsubmit={submit}>
    <h2 id="sign-in-title" class="label">Sign in</h2>

    {#if session.notice}
      <p class="notice" role="alert">{session.notice}</p>
    {/if}

    <label class="field">
      <span class="label">Email</span>
      <input
        type="email"
        name="email"
        autocomplete="username"
        autocapitalize="none"
        spellcheck="false"
        required
        bind:value={email}
      />
    </label>

    <label class="field">
      <span class="label">Password</span>
      <input
        type="password"
        name="password"
        autocomplete="current-password"
        required
        bind:value={password}
        bind:this={passwordInput}
      />
    </label>

    <button type="submit" class="button-primary" disabled={session.signingIn}>
      {session.signingIn ? 'Signing in…' : 'Sign in'}
    </button>

    <p class="muted small">Accounts are by invitation. Forgot your password? Ask the owner to reset it.</p>
  </form>
</main>

<style>
  .sign-in {
    display: grid;
    align-content: center;
    gap: var(--space-4);
    width: 100%;
    max-width: 400px;
    min-height: 100dvh;
    margin: 0 auto;
    padding: var(--space-6) var(--space-4);
  }

  .brand {
    font-size: 40px;
  }

  .tagline {
    margin: calc(-1 * var(--space-3)) 0 var(--space-4);
  }

  .card {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-6) var(--space-4);
  }

  h2,
  p {
    margin: 0;
  }

  .field {
    display: grid;
    gap: var(--space-2);
  }

  input {
    min-height: var(--tap);
    padding: 0 var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: var(--raised);
    /* 16px keeps iOS from zooming in on focus. */
    font-size: 16px;
  }

  input:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 0;
  }

  button {
    width: 100%;
  }

  button:disabled {
    opacity: 0.7;
    cursor: progress;
  }

</style>

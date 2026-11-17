<script lang="ts">
  import { ChevronRight, LogOut } from '@lucide/svelte';
  import ChangePasswordForm from './ChangePasswordForm.svelte';
  import DataCard from './DataCard.svelte';
  import { APP_VERSION } from '../lib/app-version';
  import { session } from '../lib/state/session.svelte';
  import { theme } from '../lib/state/theme.svelte';
  import { THEME_LABELS, THEMES } from '../lib/theme';

  const isDemo = $derived(Boolean(session.user?.demo));
  let changingPassword = $state(false);
  let passwordChanged = $state(false);

  function passwordDone(changed: boolean) {
    changingPassword = false;
    passwordChanged = changed;
  }
</script>

<section class="settings" aria-labelledby="settings-title">
  <h1 id="settings-title" class="display laptop-only">Settings</h1>

  <section class="card" aria-labelledby="account-title">
    <h2 id="account-title" class="label">Account</h2>
    <p class="row">
      <span class="muted">Signed in as</span>
      <span class="email">{session.user?.email}</span>
    </p>

    {#if isDemo}
      <p class="muted small">This is a demo account. Its password can't be changed.</p>
    {:else if changingPassword}
      <ChangePasswordForm onDone={passwordDone} />
    {:else}
      {#if passwordChanged}
        <p class="small" role="status">Password changed. Your other devices have been signed out.</p>
      {/if}
      <button
        type="button"
        class="button-secondary with-icon"
        aria-expanded="false"
        onclick={() => {
          passwordChanged = false;
          changingPassword = true;
        }}
      >
        Change password
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    {/if}
  </section>

  <section class="card" aria-labelledby="appearance-title">
    <h2 id="appearance-title" class="label">Appearance</h2>
    <fieldset>
      <legend>Theme</legend>
      <div class="segmented">
        {#each THEMES as option (option)}
          <label>
            <input
              type="radio"
              name="theme"
              value={option}
              checked={theme.preference === option}
              onchange={() => theme.choose(option, session.user)}
            />
            <span>{THEME_LABELS[option]}</span>
          </label>
        {/each}
      </div>
    </fieldset>
    {#if isDemo}
      <p class="muted small">Saved on this device only.</p>
    {/if}
    {#if theme.error}
      <p class="notice" role="alert">{theme.error}</p>
    {/if}
  </section>

  <DataCard />

  <button type="button" class="button-secondary with-icon sign-out" onclick={() => session.signOut()}>
    <LogOut size={18} aria-hidden="true" />
    Sign out
  </button>

  <p class="version muted small num" data-testid="app-version">{APP_VERSION}</p>
</section>

<style>
  .settings {
    display: grid;
    gap: var(--space-4);
    max-width: 560px;
  }

  @media (min-width: 768px) {
    .settings {
      margin: 0 auto;
      width: 100%;
    }
  }

  .card {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-4);
  }

  h2,
  p {
    margin: 0;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .email {
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .with-icon {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    width: 100%;
    padding: 0 var(--space-4);
  }

  .sign-out {
    justify-content: center;
  }

  fieldset {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    padding: 0;
    margin-bottom: var(--space-2);
  }

  /* System / Light / Dark: real radio buttons, drawn as one segmented
     control. The selected option is ink-filled, like the exercise pills. */
  .segmented {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    padding: var(--space-1);
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: var(--raised);
  }

  .segmented label {
    position: relative;
  }

  .segmented input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  .segmented span {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    border-radius: calc(var(--radius-control) - 3px);
    font-weight: 600;
    color: var(--muted);
  }

  .segmented input:checked + span {
    background: var(--ink);
    color: var(--bg);
  }

  .segmented input:focus-visible + span {
    outline: 2px solid var(--ink);
    outline-offset: 2px;
  }

  .version {
    text-align: center;
  }

</style>

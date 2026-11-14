<script lang="ts">
  import { checkNewPassword, passwordChangeErrorMessage } from '../lib/auth';
  import { session } from '../lib/state/session.svelte';

  /** Called after a successful change, or when the user cancels. */
  let { onDone }: { onDone: (changed: boolean) => void } = $props();

  let current = $state('');
  let next = $state('');
  let confirm = $state('');
  let error = $state<string | null>(null);
  let saving = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = checkNewPassword(current, next, confirm);
    if (error) return;
    saving = true;
    try {
      await session.changePassword(current, next);
      onDone(true);
    } catch (err) {
      error = passwordChangeErrorMessage(err);
    } finally {
      saving = false;
    }
  }
</script>

<!-- novalidate: checks are done in checkNewPassword, with clearer messages. -->
<form class="change-password" onsubmit={submit} novalidate>
  {#if error}
    <p class="notice" role="alert">{error}</p>
  {/if}

  <label class="field">
    <span class="label">Current password</span>
    <input type="password" autocomplete="current-password" bind:value={current} />
  </label>
  <label class="field">
    <span class="label">New password</span>
    <input type="password" autocomplete="new-password" bind:value={next} />
  </label>
  <label class="field">
    <span class="label">Confirm new password</span>
    <input type="password" autocomplete="new-password" bind:value={confirm} />
  </label>
  <p class="muted small">At least 8 characters. Your other devices will be signed out.</p>

  <div class="actions">
    <button type="button" class="button-secondary" onclick={() => onDone(false)}>Cancel</button>
    <button type="submit" class="button-primary" disabled={saving}>
      {saving ? 'Saving…' : 'Save password'}
    </button>
  </div>
</form>

<style>
  .change-password {
    display: grid;
    gap: var(--space-4);
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
    font-size: 16px; /* keeps iOS from zooming in on focus */
  }

  input:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 0;
  }

  p {
    margin: 0;
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  /* Half-width at 390 px: less padding, so the labels fit on one line. */
  .actions button {
    padding: 0 var(--space-3);
    white-space: nowrap;
  }

</style>

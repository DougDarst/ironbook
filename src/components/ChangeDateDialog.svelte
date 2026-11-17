<script lang="ts" module>
  /** Problem saving a new date: a message, and the workout already on that date, if any. */
  export type DateProblem = { message: string; existingId?: string };
</script>

<script lang="ts">
  import { formatDayDate } from '../lib/format';
  import { isValidDate } from '../lib/model/dates';
  import { hrefForWorkout } from '../lib/state/router.svelte';

  /**
   * Move a workout to another date: today or earlier, and not a date that
   * already has a workout (then it offers to open that one instead).
   */
  let {
    open,
    date,
    today,
    onSave,
    onCancel,
  }: {
    open: boolean;
    date: string;
    today: string;
    /** Resolves with a problem to show, or null when saved. */
    onSave: (date: string) => Promise<DateProblem | null>;
    onCancel: () => void;
  } = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  const uid = $props.id();
  let value = $state('');
  let problem = $state<DateProblem | null>(null);
  let busy = $state(false);

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      value = date;
      problem = null;
      busy = false;
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  });

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!isValidDate(value)) {
      problem = { message: 'Pick a date.' };
      return;
    }
    if (value > today) {
      problem = { message: "A workout can't be in the future." };
      return;
    }
    if (value === date) {
      onCancel();
      return;
    }
    busy = true;
    problem = await onSave(value);
    busy = false;
  }
</script>

<dialog
  bind:this={dialog}
  class="card"
  aria-labelledby="{uid}-title"
  oncancel={(e) => {
    e.preventDefault();
    onCancel();
  }}
>
  <form novalidate onsubmit={save}>
    <h2 id="{uid}-title" class="title">Change date</h2>
    <label class="field">
      <span class="label">Date</span>
      <input type="date" max={today} required bind:value aria-describedby={problem ? `${uid}-problem` : undefined} />
    </label>
    {#if problem}
      <div class="notice" id="{uid}-problem" role="alert">
        <p>{problem.message}</p>
        {#if problem.existingId}
          <a href={hrefForWorkout(problem.existingId)} onclick={onCancel}>Open the workout of {formatDayDate(value, today)}</a>
        {/if}
      </div>
    {/if}
    <div class="actions">
      <button type="button" class="button-secondary" onclick={onCancel}>Cancel</button>
      <button type="submit" class="button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
    </div>
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
  .field,
  .notice {
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

  .notice a {
    color: var(--ink);
    font-weight: 600;
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  button:disabled {
    opacity: 0.7;
    cursor: progress;
  }
</style>

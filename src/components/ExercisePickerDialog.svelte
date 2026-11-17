<script lang="ts">
  import { Plus } from '@lucide/svelte';
  import { addExercise, type Exercise } from '../lib/data/logbook';
  import { MAX_EXERCISE_NAME, normalizeExerciseName } from '../lib/model/exercises';
  import { session } from '../lib/state/session.svelte';
  import { matchesSearch } from '../lib/workout';

  /**
   * Pick an exercise for a workout ("Add exercise", "Switch exercise"): search
   * your exercises or add a new one. Exercises already in the workout are
   * listed but can't be picked (one of each per workout).
   */
  let {
    open,
    title,
    exercises,
    taken,
    onPick,
    onCancel,
    onCreated,
  }: {
    open: boolean;
    title: string;
    exercises: readonly Exercise[];
    /** Ids of the exercises already in this workout. */
    taken: ReadonlySet<string>;
    /** Resolves with an error message to show, or null when done. */
    onPick: (exercise: Exercise) => Promise<string | null>;
    onCancel: () => void;
    /** A new exercise was created (to add it to the list). */
    onCreated: (exercise: Exercise) => void;
  } = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  const uid = $props.id();

  let query = $state('');
  let adding = $state(false);
  let newName = $state('');
  let error = $state<string | null>(null);
  let busy = $state(false);

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      query = '';
      adding = false;
      newName = '';
      error = null;
      busy = false;
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  });

  const visible = $derived(exercises.filter((e) => matchesSearch(e.name, query)));

  async function pick(exercise: Exercise) {
    if (busy || taken.has(exercise.id)) return;
    busy = true;
    error = await onPick(exercise);
    busy = false;
  }

  async function add(event: SubmitEvent) {
    event.preventDefault();
    const name = normalizeExerciseName(newName);
    if (!name) {
      error = 'Enter a name.';
      return;
    }
    if (name.length > MAX_EXERCISE_NAME) {
      error = `Keep it to ${MAX_EXERCISE_NAME} characters.`;
      return;
    }
    error = null;
    busy = true;
    try {
      const { exercise, existed } = await addExercise(session.user!.id, name);
      if (!existed) onCreated(exercise);
      busy = false;
      if (taken.has(exercise.id)) {
        error = `${exercise.name} is already in this workout.`;
        return;
      }
      await pick(exercise);
    } catch {
      busy = false;
      error = "Couldn't add the exercise. Please try again.";
    }
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
  <!-- Focus starts on the title, so the iPhone keyboard doesn't cover the list. -->
  <!-- svelte-ignore a11y_autofocus -->
  <h2 id="{uid}-title" class="title" tabindex="-1" autofocus>{title}</h2>

  <label class="search">
    <span class="visually-hidden">Search exercises</span>
    <input type="search" placeholder="Search exercises" autocomplete="off" bind:value={query} />
  </label>

  {#if error}
    <p class="notice" role="alert">{error}</p>
  {/if}

  <ul class="list" aria-label="Exercises">
    {#each visible as exercise (exercise.id)}
      {@const inWorkout = taken.has(exercise.id)}
      <li>
        <button type="button" disabled={inWorkout || busy} onclick={() => pick(exercise)}>
          <span class="name">{exercise.name}</span>
          {#if inWorkout}<span class="small muted">In this workout</span>{/if}
        </button>
      </li>
    {:else}
      <li class="none muted small">No exercises match.</li>
    {/each}
  </ul>

  {#if adding}
    <form class="new" onsubmit={add}>
      <label class="label" for="{uid}-new">New exercise</label>
      <div class="row">
        <!-- svelte-ignore a11y_autofocus -->
        <input
          id="{uid}-new"
          type="text"
          autocomplete="off"
          autocapitalize="words"
          autofocus
          maxlength={MAX_EXERCISE_NAME + 20}
          bind:value={newName}
        />
        <button type="submit" class="button-primary" disabled={busy}>Add</button>
      </div>
    </form>
  {:else}
    <button type="button" class="button-secondary new-toggle" onclick={() => (adding = true)}>
      <Plus size={18} aria-hidden="true" />
      New exercise
    </button>
  {/if}

  <button type="button" class="button-secondary cancel" onclick={onCancel}>Cancel</button>
</dialog>

<style>
  dialog {
    width: min(440px, calc(100vw - 2 * var(--space-4)));
    max-height: calc(100dvh - 2 * var(--space-6));
    padding: var(--space-6) var(--space-4) var(--space-4);
    color: var(--ink);
  }

  dialog[open] {
    display: grid;
    gap: var(--space-3);
  }

  dialog::backdrop {
    background: rgb(0 0 0 / 0.5);
  }

  h2,
  p {
    margin: 0;
  }

  h2:focus {
    outline: none;
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

  .list {
    max-height: 40dvh;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
  }

  .list li + li {
    border-top: 1px solid var(--line);
  }

  .list button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    width: 100%;
    min-height: var(--tap);
    padding: var(--space-2) var(--space-3);
    border: 0;
    background: none;
    text-align: left;
  }

  .list button:not(:disabled):hover {
    background: var(--raised);
  }

  .list button:disabled {
    cursor: not-allowed;
  }

  .list button:disabled .name {
    color: var(--muted);
  }

  .name {
    font-weight: 600;
  }

  .none {
    padding: var(--space-3);
  }

  .new {
    display: grid;
    gap: var(--space-2);
  }

  .row {
    display: flex;
    gap: var(--space-2);
  }

  .row button {
    flex: none;
    padding: 0 var(--space-4);
  }

  .new-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
  }
</style>

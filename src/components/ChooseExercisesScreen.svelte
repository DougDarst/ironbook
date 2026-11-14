<script lang="ts">
  import { Check, Plus } from '@lucide/svelte';
  import { onDestroy } from 'svelte';
  import { doneVolume, lastTime } from '../lib/calc';
  import {
    addExercise,
    findWorkoutByDate,
    listExercises,
    listSessions,
    startWorkout,
    type Exercise,
    type SessionEntry,
  } from '../lib/data/logbook';
  import { formatDayDate, formatShortDate, formatVolume } from '../lib/format';
  import { isValidDate } from '../lib/model/dates';
  import { MAX_EXERCISE_NAME, normalizeExerciseName } from '../lib/model/exercises';
  import { layout } from '../lib/state/layout.svelte';
  import { hrefForWorkout, router } from '../lib/state/router.svelte';
  import { session } from '../lib/state/session.svelte';
  import { matchesSearch } from '../lib/workout';

  /** Start of a workout: pick the date and the exercises, then start. */
  let { today }: { today: string } = $props();

  // Starts at today; "Change date" changes it afterwards.
  // svelte-ignore state_referenced_locally
  let date = $state(today);
  let exercises = $state<Exercise[]>([]);
  let sessions = $state<SessionEntry[]>([]);
  let loaded = $state(false);
  let error = $state<string | null>(null);

  let query = $state('');
  /** Selected exercise ids, in the order they were ticked (= entry order). */
  let selected = $state<string[]>([]);

  let adding = $state(false);
  let newName = $state('');
  let addError = $state<string | null>(null);
  let starting = $state(false);
  let dateInput: HTMLInputElement | undefined = $state();

  $effect(() => {
    Promise.all([listExercises(), listSessions()])
      .then(([e, s]) => {
        exercises = e;
        sessions = s;
        loaded = true;
      })
      .catch(() => (error = "Couldn't load your exercises. Check your connection and reload."));
  });

  // On iPhone the Start bar replaces the tab bar while something is ticked.
  $effect(() => {
    layout.hideTabBar = selected.length > 0;
  });
  onDestroy(() => (layout.hideTabBar = false));

  const visible = $derived(exercises.filter((e) => matchesSearch(e.name, query)));

  function lastLabel(exerciseId: string): string {
    const last = lastTime(sessions, exerciseId, date);
    if (!last) return 'Not logged yet';
    return `Last: ${formatShortDate(last.date, today)} · ${formatVolume(doneVolume(last.sets))} lb`;
  }

  function toggle(id: string) {
    selected = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
  }

  function changeDate() {
    if (!dateInput) return;
    try {
      dateInput.showPicker();
    } catch {
      dateInput.focus();
      dateInput.click();
    }
  }

  async function dateChosen(value: string) {
    if (!isValidDate(value) || value > today || value === date) return;
    error = null;
    try {
      const existing = await findWorkoutByDate(value);
      if (existing) router.go(hrefForWorkout(existing.id)); // one workout per date
      else date = value;
    } catch {
      error = "Couldn't check that date. Please try again.";
    }
  }

  async function add(event: SubmitEvent) {
    event.preventDefault();
    const name = normalizeExerciseName(newName);
    if (!name) {
      addError = 'Enter a name.';
      return;
    }
    if (name.length > MAX_EXERCISE_NAME) {
      addError = `Keep it to ${MAX_EXERCISE_NAME} characters.`;
      return;
    }
    addError = null;
    try {
      const { exercise, existed } = await addExercise(session.user!.id, name);
      if (!existed) exercises = [...exercises, exercise].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      if (!selected.includes(exercise.id)) selected = [...selected, exercise.id];
      newName = '';
      query = '';
      adding = false;
    } catch {
      addError = "Couldn't add the exercise. Please try again.";
    }
  }

  async function start() {
    starting = true;
    error = null;
    try {
      const result = await startWorkout(session.user!.id, date, selected, sessions);
      router.go(hrefForWorkout(result.started ? result.workoutId : result.existing.id));
    } catch {
      error = "Couldn't start the workout. Please try again.";
      starting = false;
    }
  }
</script>

<section class="choose" class:with-bar={selected.length > 0} aria-labelledby="choose-title">
  <header class="head">
    <div>
      <p class="label">New workout</p>
      <h1 id="choose-title" class="display">{formatDayDate(date, today)}</h1>
    </div>
    <button type="button" class="button-secondary" onclick={changeDate}>Change date</button>
    <input
      bind:this={dateInput}
      class="date-input"
      type="date"
      max={today}
      value={date}
      aria-label="Workout date"
      tabindex="-1"
      onchange={(e) => dateChosen(e.currentTarget.value)}
    />
  </header>

  {#if error}
    <p class="notice" role="alert">{error}</p>
  {/if}

  {#if !loaded && !error}
    <p class="muted" aria-live="polite">Loading…</p>
  {:else if loaded}
    {#if exercises.length > 0}
      <label class="search">
        <span class="label">What are you lifting today?</span>
        <input type="search" placeholder="Search exercises" autocomplete="off" bind:value={query} />
      </label>

      <ul class="list" aria-label="Exercises">
        {#each visible as exercise (exercise.id)}
          {@const isSelected = selected.includes(exercise.id)}
          <li>
            <label class="exercise" class:selected={isSelected}>
              <span class="text">
                <span class="title">{exercise.name}</span>
                <span class="last muted">{lastLabel(exercise.id)}</span>
              </span>
              <input type="checkbox" checked={isSelected} onchange={() => toggle(exercise.id)} />
              <span class="box" aria-hidden="true">
                {#if isSelected}<Check size={20} strokeWidth={3} />{/if}
              </span>
            </label>
          </li>
        {:else}
          <li class="muted none">No exercises match “{query.trim()}”.</li>
        {/each}
      </ul>
    {/if}

    {#if adding}
      <form class="new-form" onsubmit={add}>
        {#if addError}
          <p class="notice" role="alert">{addError}</p>
        {/if}
        <label class="field">
          <span class="label">New exercise</span>
          <!-- svelte-ignore a11y_autofocus -->
          <input type="text" autocomplete="off" autocapitalize="words" autofocus maxlength={MAX_EXERCISE_NAME + 20} bind:value={newName} />
        </label>
        <div class="actions">
          <button
            type="button"
            class="button-secondary"
            onclick={() => {
              adding = false;
              addError = null;
              newName = '';
            }}>Cancel</button
          >
          <button type="submit" class="button-secondary">Add</button>
        </div>
      </form>
    {:else}
      <button
        type="button"
        class="new"
        onclick={() => {
          adding = true;
          newName = query.trim();
        }}
      >
        <Plus size={22} aria-hidden="true" />
        New exercise
      </button>
    {/if}

    <p class="hint muted">
      {#if exercises.length === 0}
        Add your first exercise to start logging. You'll pick from your exercises each time you train.
      {:else}
        Each exercise you pick opens with last time's weights and reps filled in. A new exercise starts with 20 empty
        sets.
      {/if}
    </p>
  {/if}
</section>

{#if selected.length > 0}
  <div class="action-bar">
    <button type="button" class="button-primary" disabled={starting} onclick={start}>
      {starting ? 'Starting…' : `Start workout (${selected.length})`}
    </button>
  </div>
{/if}

<style>
  .choose {
    display: grid;
    gap: var(--space-4);
    max-width: 560px;
    margin: 0 auto;
    padding-top: env(safe-area-inset-top);
  }

  /* Room for the fixed Start bar, so it never covers the end of the list. */
  .choose.with-bar {
    padding-bottom: calc(96px + env(safe-area-inset-bottom));
  }

  p {
    margin: 0;
  }

  .head {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .head .display {
    font-size: 32px;
  }

  /* The native date picker, opened by "Change date"; kept off-screen. */
  .date-input {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  .search {
    display: grid;
    gap: var(--space-2);
  }

  input[type='search'],
  input[type='text'] {
    min-height: 52px;
    padding: 0 var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: var(--surface);
    font-size: 16px; /* keeps iOS from zooming in on focus */
  }

  input[type='search']:focus-visible,
  input[type='text']:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 0;
  }

  .list {
    display: grid;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .none {
    padding: var(--space-2) 0;
  }

  /* An exercise card: the whole card toggles the (real) checkbox. */
  .exercise {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 72px;
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--radius-card);
    background: var(--surface);
    cursor: pointer;
  }

  .exercise.selected {
    border-color: var(--accent);
    background: var(--done-tint);
  }

  .exercise:has(input:focus-visible) {
    outline: 2px solid var(--ink);
    outline-offset: 2px;
  }

  .text {
    display: grid;
    flex: 1;
    min-width: 0;
  }

  .title {
    font-family: var(--font-heading);
    font-weight: 600;
    font-size: 21px;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .last {
    font-size: 15px;
    font-variant-numeric: tabular-nums;
  }

  .exercise input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  .box {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 2px solid var(--line);
    border-radius: 8px;
    color: var(--on-accent);
  }

  .selected .box {
    border-color: var(--accent);
    background: var(--accent);
  }

  .new {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 64px;
    padding: 0 var(--space-4);
    border: 1px dashed var(--line);
    border-radius: var(--radius-card);
    background: transparent;
    font-weight: 600;
    text-align: left;
  }

  .new-form {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px dashed var(--line);
    border-radius: var(--radius-card);
  }

  .field {
    display: grid;
    gap: var(--space-2);
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .hint {
    font-size: 15px;
  }

  /* The bottom action bar: the only element with a shadow (see the design). */
  .action-bar {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 20;
    padding: var(--space-3) var(--space-4);
    padding-bottom: calc(var(--space-3) + env(safe-area-inset-bottom));
    border-top: 1px solid var(--line);
    background: var(--bg);
    box-shadow: 0 -4px 16px rgb(0 0 0 / 0.08);
  }

  .action-bar button {
    display: block;
    width: 100%;
    max-width: 560px;
    min-height: 56px;
    margin: 0 auto;
    font-size: 18px;
  }

  .action-bar button:disabled {
    opacity: 0.7;
    cursor: progress;
  }
</style>

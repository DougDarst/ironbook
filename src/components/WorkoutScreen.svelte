<script lang="ts">
  import { onDestroy } from 'svelte';
  import SetsTable from './SetsTable.svelte';
  import SummaryCard from './SummaryCard.svelte';
  import WorkoutMenu from './WorkoutMenu.svelte';
  import { doneVolume, lastTime } from '../lib/calc';
  import { APP } from '../lib/config';
  import {
    getWorkout,
    listSessions,
    saveEntrySets,
    watchWorkoutEntries,
    type SessionEntry,
    type WorkoutDetail,
  } from '../lib/data/logbook';
  import { formatDayDate } from '../lib/format';
  import { localToday } from '../lib/model/dates';
  import { EntryEditor, overallStatus } from '../lib/state/entry-editor.svelte';
  import { layout } from '../lib/state/layout.svelte';
  import { hrefFor } from '../lib/state/router.svelte';

  /** The Log screen: enter sets for each exercise of one workout. Saves as you go. */
  let { id }: { id: string } = $props();

  const today = localToday();
  let workout = $state.raw<WorkoutDetail | null>(null);
  let sessions = $state.raw<SessionEntry[]>([]);
  let editors = $state.raw<EntryEditor[]>([]);
  let active = $state(0);
  let error = $state(false);
  let deleted = $state(false);
  let unsubscribe: (() => Promise<void>) | null = null;

  layout.hideTabBar = true;

  $effect(() => {
    Promise.all([getWorkout(id), listSessions()])
      .then(async ([w, s]) => {
        workout = w;
        sessions = s;
        editors = w.entries.map((e) => new EntryEditor(e.id, e.sets, saveEntrySets));
        // Changes saved on another device appear here (never over what you're typing).
        unsubscribe = await watchWorkoutEntries(id, (action, entry) => {
          if (action === 'update') editors.find((e) => e.id === entry.id)?.applyRemote(entry.sets);
          if (action === 'delete') deleted = true;
        });
      })
      .catch(() => (error = true));
  });

  // Save straight away when the page is hidden or closed (switching apps on
  // the phone, closing the tab), and when leaving this screen.
  function flushAll(keepalive: boolean) {
    for (const editor of editors) void editor.flush(keepalive);
  }
  function onVisibility() {
    if (document.visibilityState === 'hidden') flushAll(true);
  }

  onDestroy(() => {
    flushAll(false);
    for (const editor of editors) editor.dispose();
    void unsubscribe?.();
    layout.hideTabBar = false;
  });

  const status = $derived(overallStatus(editors.map((e) => e.status)));
  const STATUS_TEXT = { saved: 'Saved', unsaved: 'Saving…', saving: 'Saving…', error: 'Not saved yet, retrying…' };

  function lastFor(exerciseId: string) {
    if (!workout) return null;
    const last = lastTime(sessions, exerciseId, workout.date);
    return last ? { date: last.date, volume: doneVolume(last.sets) } : null;
  }

  /** Arrow keys move between the exercise tabs (the tabs pattern). */
  function tabKey(event: KeyboardEvent) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step || editors.length === 0) return;
    event.preventDefault();
    active = (active + step + editors.length) % editors.length;
    document.getElementById(`tab-${editors[active]!.id}`)?.focus();
  }
</script>

<svelte:window onpagehide={() => flushAll(true)} />
<svelte:document onvisibilitychange={onVisibility} />

<section class="workout" aria-labelledby="workout-title">
  {#if error}
    <p class="notice" role="alert">Couldn't load this workout. Check your connection and reload.</p>
  {:else if workout}
    <header class="head">
      <div>
        <p class="label">{APP.name}</p>
        <h1 id="workout-title" class="display">{formatDayDate(workout.date, today)}</h1>
      </div>
      <div class="actions">
        <span class="status small muted" class:problem={status === 'error'} role="status" data-testid="save-status">
          {STATUS_TEXT[status]}
        </span>
        <WorkoutMenu />
      </div>
    </header>

    {#if deleted}
      <p class="notice" role="alert">
        This workout was deleted on another device. <a href={hrefFor('log')}>Back to Log</a>
      </p>
    {/if}

    <div class="pills" role="tablist" aria-label="Exercises" tabindex="-1" onkeydown={tabKey}>
      {#each workout.entries as entry, i (entry.id)}
        <button
          type="button"
          role="tab"
          id="tab-{entry.id}"
          class="pill"
          aria-selected={i === active}
          aria-controls="panel-{entry.id}"
          tabindex={i === active ? 0 : -1}
          onclick={() => (active = i)}
        >
          {entry.exercise.name}
        </button>
      {/each}
    </div>

    {#each workout.entries as entry, i (entry.id)}
      <div class="panel" role="tabpanel" id="panel-{entry.id}" aria-labelledby="tab-{entry.id}" hidden={i !== active}>
        {#if i === active && editors[i]}
          <SummaryCard name={entry.exercise.name} sets={editors[i].sets} last={lastFor(entry.exercise.id)} {today} />
          <SetsTable editor={editors[i]} />
        {/if}
      </div>
    {/each}
  {:else}
    <p class="muted" aria-live="polite">Loading…</p>
  {/if}
</section>

<style>
  .workout {
    display: grid;
    gap: var(--space-4);
    max-width: 560px;
    margin: 0 auto;
    padding-top: env(safe-area-inset-top);
  }

  p {
    margin: 0;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .head .display {
    font-size: 32px;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .status {
    text-align: right;
  }

  .status.problem {
    color: var(--ink);
    font-weight: 600;
  }

  /* Exercise tabs: scroll sideways; the selected one is ink-filled. */
  .pills {
    display: flex;
    gap: var(--space-2);
    margin: 0 calc(-1 * var(--space-4));
    padding: 0 var(--space-4) var(--space-1);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .pill {
    flex: none;
    min-height: var(--tap);
    padding: 0 var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--radius-pill);
    background: var(--surface);
    font-weight: 600;
    white-space: nowrap;
  }

  .pill[aria-selected='true'] {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--bg);
  }

  .panel {
    display: grid;
    gap: var(--space-4);
  }

  .panel[hidden] {
    display: none;
  }
</style>

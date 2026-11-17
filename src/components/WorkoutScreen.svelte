<script lang="ts">
  import { onDestroy } from 'svelte';
  import ChangeDateDialog, { type DateProblem } from './ChangeDateDialog.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import ExercisePickerDialog from './ExercisePickerDialog.svelte';
  import SetsTable from './SetsTable.svelte';
  import SummaryCard from './SummaryCard.svelte';
  import WorkoutMenu from './WorkoutMenu.svelte';
  import { doneVolume, lastTime } from '../lib/calc';
  import { APP } from '../lib/config';
  import {
    addEntry,
    changeWorkoutDate,
    deleteWorkout,
    finishWorkout,
    getWorkout,
    listExercises,
    listSessions,
    removeEntry,
    saveEntrySets,
    switchEntryExercise,
    watchWorkout,
    watchWorkoutEntries,
    type Exercise,
    type SessionEntry,
    type WorkoutDetail,
  } from '../lib/data/logbook';
  import { untickedCount } from '../lib/entry';
  import { formatDayDate } from '../lib/format';
  import { localToday } from '../lib/model/dates';
  import { MAX_EXERCISES_PER_WORKOUT } from '../lib/model/workouts';
  import { EntryEditor, overallStatus } from '../lib/state/entry-editor.svelte';
  import { layout } from '../lib/state/layout.svelte';
  import { hrefFor } from '../lib/state/router.svelte';
  import { session } from '../lib/state/session.svelte';

  /**
   * The Log screen: enter sets for each exercise of one workout. Saves as you
   * go. The "•••" menu changes the date, adds, switches or removes exercises,
   * and deletes the workout (also for past workouts opened from History).
   */
  let { id }: { id: string } = $props();

  const today = localToday();
  let workout = $state.raw<WorkoutDetail | null>(null);
  let sessions = $state.raw<SessionEntry[]>([]);
  let exercises = $state.raw<Exercise[]>([]);
  let editors = $state.raw<EntryEditor[]>([]);
  let active = $state(0);
  let error = $state(false);
  let deleted = $state(false);
  let status = $state<'draft' | 'finished'>('draft');
  let confirming = $state<'finish' | 'delete' | 'remove' | null>(null);
  /** The open editing dialog, if any. */
  let editing = $state<'date' | 'add' | 'switch' | null>(null);
  let busy = $state(false);
  let actionError = $state<string | null>(null);
  let unsubscribers: (() => Promise<void>)[] = [];
  /** Realtime is connected (changes from other devices will arrive). */
  let live = $state(false);

  // The selected exercise's tab stays in view (e.g. one just added at the end).
  $effect(() => {
    const selected = editors[active];
    if (selected) document.getElementById(`tab-${selected.id}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });

  // A draft shows the Finish bar in place of the tab bar (iPhone).
  $effect(() => {
    layout.hideTabBar = status === 'draft' && !deleted;
  });

  $effect(() => {
    Promise.all([getWorkout(id), listSessions(), listExercises()])
      .then(async ([w, s, e]) => {
        workout = w;
        sessions = s;
        exercises = e;
        status = w.status;
        editors = w.entries.map((e) => new EntryEditor(e.id, e.sets, saveEntrySets));
        // Changes saved on another device appear here (never over what you're typing).
        unsubscribers.push(
          await watchWorkoutEntries(id, (action, entry) => {
            const known = workout?.entries.find((e) => e.id === entry.id);
            if (action === 'update' && known && known.exercise.id === entry.exercise) {
              editors.find((e) => e.id === entry.id)?.applyRemote(entry.sets);
            } else {
              void refresh(); // an exercise was added, removed or switched
            }
          }),
          await watchWorkout(id, (action, changed) => {
            if (action === 'update') {
              status = changed.status;
              if (workout && changed.date !== workout.date) workout = { ...workout, date: changed.date };
            }
            if (action === 'delete') stopEditing();
          }),
        );
        live = true;
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

  let refreshing = false;
  let refreshAgain = false;
  /** The entry whose tab to select after the next refresh. */
  let selectNext: string | null = null;

  /**
   * Reloads the workout's exercises after one was added, removed or switched
   * (here or on another device). Editors of entries still there are kept, so
   * nothing being typed or waiting to save is lost.
   */
  async function refresh(select?: string) {
    if (select) selectNext = select;
    if (refreshing) {
      refreshAgain = true;
      return;
    }
    refreshing = true;
    try {
      do {
        refreshAgain = false;
        const w = await getWorkout(id);
        const current = editors[active]?.id;
        const kept = new Map(editors.map((e) => [e.id, e]));
        const next = w.entries.map((entry) => {
          const editor = kept.get(entry.id);
          if (!editor) return new EntryEditor(entry.id, entry.sets, saveEntrySets);
          kept.delete(entry.id);
          editor.applyRemote(entry.sets);
          return editor;
        });
        for (const gone of kept.values()) gone.discard();
        workout = w;
        status = w.status;
        editors = next;
        const index = next.findIndex((e) => e.id === (selectNext ?? current));
        active = index >= 0 ? index : Math.max(0, Math.min(active, next.length - 1));
      } while (refreshAgain);
      selectNext = null;
    } catch {
      if (!deleted) actionError = "Couldn't reload this workout. Check your connection and reload.";
    } finally {
      refreshing = false;
    }
  }

  /** The workout is gone: stop saving (nothing left to save to). */
  function stopEditing() {
    deleted = true;
    for (const editor of editors) editor.dispose();
  }

  onDestroy(() => {
    if (!deleted) flushAll(false);
    for (const editor of editors) editor.dispose();
    for (const stop of unsubscribers) void stop();
    layout.hideTabBar = false;
  });

  const saveStatus = $derived(overallStatus(editors.map((e) => e.status)));
  const unticked = $derived(editors.reduce((n, e) => n + untickedCount(e.sets), 0));

  /** Finish: save everything first; ask only if entered sets aren't ticked. */
  async function finish(confirmed = false) {
    actionError = null;
    if (!confirmed && unticked > 0) {
      confirming = 'finish';
      return;
    }
    busy = true;
    try {
      await Promise.all(editors.map((e) => e.flush()));
      await finishWorkout(id);
      status = 'finished';
      confirming = null;
    } catch {
      actionError = "Couldn't finish the workout. Please try again.";
    } finally {
      busy = false;
    }
  }

  async function remove() {
    busy = true;
    actionError = null;
    try {
      stopEditing();
      await deleteWorkout(id);
      confirming = null;
      window.location.replace(hrefFor('log'));
    } catch {
      deleted = false;
      actionError = "Couldn't delete the workout. Please try again.";
      confirming = null;
    } finally {
      busy = false;
    }
  }

  const entryCount = $derived(workout?.entries.length ?? 0);
  const current = $derived(workout?.entries[active] ?? null);
  const inWorkout = $derived(new Set(workout?.entries.map((e) => e.exercise.id) ?? []));

  /** Moves the workout to another date, unless that date already has one. */
  async function saveDate(date: string): Promise<DateProblem | null> {
    try {
      const result = await changeWorkoutDate(id, date);
      if (!result.changed) {
        return { message: `You already have a workout on ${formatDayDate(date, today)}.`, existingId: result.existing.id };
      }
      if (workout) workout = { ...workout, date };
      editing = null;
      return null;
    } catch {
      return { message: "Couldn't change the date. Please try again." };
    }
  }

  /** The exercise picker chose one: add it, or switch the selected exercise to it. */
  async function picked(exercise: Exercise): Promise<string | null> {
    const adding = editing === 'add';
    try {
      if (adding) {
        await refresh(await addEntry(session.user!.id, workout!, exercise.id, sessions));
      } else {
        const entry = current!;
        await switchEntryExercise(entry.id, exercise.id);
        await refresh(entry.id);
      }
      editing = null;
      return null;
    } catch {
      return adding ? "Couldn't add the exercise. Please try again." : "Couldn't switch the exercise. Please try again.";
    }
  }

  /** Removes the selected exercise; asks first if it has any sets entered. */
  async function removeCurrent(confirmed = false) {
    const entry = current;
    const editor = editors[active];
    if (!entry || !editor) return;
    actionError = null;
    if (!confirmed && editor.sets.some((s) => s.weight !== null || s.reps !== null)) {
      confirming = 'remove';
      return;
    }
    busy = true;
    try {
      await removeEntry(entry.id);
      editor.discard();
      confirming = null;
      await refresh();
    } catch {
      actionError = `Couldn't remove ${entry.exercise.name}. Please try again.`;
      confirming = null;
    } finally {
      busy = false;
    }
  }
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

<section class="workout" aria-labelledby="workout-title" data-live={live}>
  {#if error}
    <p class="notice" role="alert">Couldn't load this workout. Check your connection and reload.</p>
  {:else if workout}
    <header class="head">
      <div>
        <p class="label">{status === 'finished' ? 'Finished' : APP.name}</p>
        <h1 id="workout-title" class="display">{formatDayDate(workout.date, today)}</h1>
      </div>
      <div class="actions">
        <span class="status small muted" class:problem={saveStatus === 'error'} role="status" data-testid="save-status">
          {STATUS_TEXT[saveStatus]}
        </span>
        <WorkoutMenu
          onChangeDate={() => (editing = 'date')}
          onAddExercise={() => (editing = 'add')}
          onSwitchExercise={() => (editing = 'switch')}
          onRemoveExercise={() => removeCurrent()}
          onDelete={() => (confirming = 'delete')}
          canAdd={entryCount < MAX_EXERCISES_PER_WORKOUT}
          canRemove={entryCount > 1}
        />
      </div>
    </header>

    {#if deleted}
      <p class="notice" role="alert">
        This workout was deleted on another device. <a href={hrefFor('log')}>Back to Log</a>
      </p>
    {/if}
    {#if actionError}
      <p class="notice" role="alert">{actionError}</p>
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

{#if workout && status === 'draft' && !deleted}
  <div class="action-bar">
    <button type="button" class="button-primary" disabled={busy} onclick={() => finish()}>
      {busy && confirming !== 'delete' ? 'Finishing…' : 'Finish workout'}
    </button>
  </div>
{/if}

<ConfirmDialog
  open={confirming === 'finish'}
  title="Finish workout?"
  message={`${unticked} ${unticked === 1 ? "set isn't" : "sets aren't"} ticked and won't count.`}
  confirmLabel="Finish anyway"
  {busy}
  onConfirm={() => finish(true)}
  onCancel={() => (confirming = null)}
/>
<ConfirmDialog
  open={confirming === 'remove'}
  title="Remove {current?.exercise.name ?? 'exercise'}?"
  message="This removes it and its sets from this workout. It can't be undone."
  confirmLabel="Remove"
  {busy}
  onConfirm={() => removeCurrent(true)}
  onCancel={() => (confirming = null)}
/>
{#if workout}
  <ChangeDateDialog
    open={editing === 'date'}
    date={workout.date}
    {today}
    onSave={saveDate}
    onCancel={() => (editing = null)}
  />
  <ExercisePickerDialog
    open={editing === 'add' || editing === 'switch'}
    title={editing === 'switch' && current ? `Switch ${current.exercise.name} to` : 'Add exercise'}
    {exercises}
    taken={inWorkout}
    onPick={picked}
    onCancel={() => (editing = null)}
    onCreated={(e) =>
      (exercises = [...exercises, e].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })))}
  />
{/if}
<ConfirmDialog
  open={confirming === 'delete'}
  title="Delete workout?"
  message={`This deletes ${workout ? formatDayDate(workout.date, today) : 'the workout'} and its ${entryCount} ${entryCount === 1 ? 'exercise' : 'exercises'}, with all their sets. It can't be undone.`}
  confirmLabel="Delete"
  {busy}
  onConfirm={remove}
  onCancel={() => (confirming = null)}
/>

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

  /* Room for the Finish bar, so it never covers the last sets. */
  .workout:has(~ .action-bar) {
    padding-bottom: calc(96px + env(safe-area-inset-bottom));
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

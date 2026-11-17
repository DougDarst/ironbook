<script lang="ts">
  import { Upload } from '@lucide/svelte';
  import { planImport, readCsv, type CsvProblem, type ImportPlan } from '../lib/csv';
  import { listExercises, listSessions } from '../lib/data/logbook';
  import { ImportStopped, runImport } from '../lib/data/import';
  import { sheetDate } from '../lib/history';
  import { localToday } from '../lib/model/dates';
  import { pb } from '../lib/pb';
  import { session } from '../lib/state/session.svelte';

  /**
   * Settings › Data › Import CSV: choose a file (the sheet's format, as
   * exported), check the preview, then confirm. Rows with problems, or
   * already logged, are listed and skipped; nothing is ever overwritten.
   */
  const MAX_FILE_BYTES = 5_000_000;
  const SHOWN_PROBLEMS = 20;

  type State =
    | { step: 'idle' }
    | { step: 'reading' }
    | { step: 'preview'; file: string; plan: ImportPlan; problems: CsvProblem[] }
    | { step: 'importing'; done: number; total: number }
    | { step: 'finished'; saved: number; created: number; addedTo: number; skipped: number }
    | { step: 'failed'; message: string };
  let view = $state<State>({ step: 'idle' });
  let input: HTMLInputElement | undefined = $state();

  const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

  async function chosen(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      view = { step: 'failed', message: "That file is too big (over 5 MB). Is it the right file?" };
      return;
    }
    view = { step: 'reading' };
    try {
      const [text, exercises, sessions] = await Promise.all([file.text(), listExercises(), listSessions()]);
      const { entries, problems } = readCsv(text, localToday());
      const plan = planImport(entries, { exercises, entries: sessions });
      view = { step: 'preview', file: file.name, plan, problems: [...problems, ...plan.refused].sort((a, b) => a.row - b.row) };
    } catch {
      view = { step: 'failed', message: "Couldn't read your data to check the file. Check your connection and try again." };
    }
  }

  function reset() {
    view = { step: 'idle' };
    if (input) input.value = '';
  }

  async function confirm() {
    if (view.step !== 'preview') return;
    const { plan, problems } = view;
    view = { step: 'importing', done: 0, total: plan.entryCount };
    try {
      const saved = await runImport(pb, session.user!.id, plan, (p) => (view = { step: 'importing', ...p }));
      view = {
        step: 'finished',
        saved,
        created: plan.workouts.filter((w) => !w.workoutId).length,
        addedTo: plan.workouts.filter((w) => w.workoutId).length,
        skipped: problems.length,
      };
    } catch (err) {
      const done = err instanceof ImportStopped ? err.done : 0;
      view = {
        step: 'failed',
        message:
          `The import stopped after ${plural(done, 'entry', 'entries')} of ${plan.entryCount.toLocaleString('en-US')}. ` +
          'Check your connection, then import the same file again: entries already imported are skipped.',
      };
    }
  }

  /** "Imported 4 entries: 4 workouts created, 1 existing workout added to. 2 rows skipped." */
  function resultText(r: { saved: number; created: number; addedTo: number; skipped: number }): string {
    const added = r.addedTo > 0 ? `, ${plural(r.addedTo, 'existing workout')} added to` : '';
    const skipped = r.skipped > 0 ? ` ${plural(r.skipped, 'row')} skipped.` : '';
    return `Imported ${plural(r.saved, 'entry', 'entries')}: ${plural(r.created, 'workout')} created${added}.${skipped}`;
  }

  /** "4 new workouts, 1 existing workout added to". */
  function workoutsText(plan: ImportPlan): string {
    const created = plan.workouts.filter((w) => !w.workoutId).length;
    const addedTo = plan.workouts.length - created;
    return `${plural(created, 'new workout')}${addedTo > 0 ? `, ${plural(addedTo, 'existing workout')} added to` : ''}`;
  }

  /** "1 new exercise: Barbell Squat", or "No new exercises". */
  function exercisesText(names: readonly string[]): string {
    return names.length === 0 ? 'No new exercises' : `${plural(names.length, 'new exercise')}: ${names.join(', ')}`;
  }

  const preview = $derived(view.step === 'preview' ? view : null);
  const dates = $derived.by(() => {
    const w = preview?.plan.workouts;
    return w && w.length > 0 ? `${sheetDate(w[0]!.date)} – ${sheetDate(w.at(-1)!.date)}` : null;
  });
</script>

<div class="import">
  {#if view.step === 'idle' || view.step === 'reading'}
    <label class="button-secondary with-icon file">
      <Upload size={18} aria-hidden="true" />
      {view.step === 'reading' ? 'Checking the file…' : 'Import CSV'}
      <input
        bind:this={input}
        class="visually-hidden"
        type="file"
        accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
        disabled={view.step === 'reading'}
        onchange={chosen}
      />
    </label>
  {:else if preview}
    <section class="preview" aria-labelledby="preview-title" data-testid="import-preview">
      <h3 id="preview-title" class="title">{preview.plan.entryCount > 0 ? 'Ready to import' : 'Nothing to import'}</h3>
      <p class="muted small">{preview.file}</p>
      {#if preview.plan.entryCount > 0}
        <ul class="facts">
          <li data-testid="import-entries">{plural(preview.plan.entryCount, 'entry', 'entries')} (one per exercise per workout)</li>
          <li data-testid="import-workouts">{workoutsText(preview.plan)}</li>
          {#if dates}<li>Dates: {dates}</li>{/if}
          <li data-testid="import-new-exercises">{exercisesText(preview.plan.newExercises)}</li>
        </ul>
        <p class="muted small">Every imported set is marked done. Nothing you already have is changed.</p>
      {/if}
      {#if preview.problems.length > 0}
        <div class="problems" data-testid="import-problems">
          <p><strong>{plural(preview.problems.length, 'row')} won't be imported:</strong></p>
          <ul>
            {#each preview.problems.slice(0, SHOWN_PROBLEMS) as p (p.row)}
              <li>Row {p.row}: {p.message}</li>
            {/each}
          </ul>
          {#if preview.problems.length > SHOWN_PROBLEMS}
            <p class="muted small">…and {preview.problems.length - SHOWN_PROBLEMS} more.</p>
          {/if}
        </div>
      {/if}
      <div class="actions">
        <button type="button" class="button-secondary" onclick={reset}>Cancel</button>
        {#if preview.plan.entryCount > 0}
          <button type="button" class="button-primary" onclick={confirm}>
            Import {plural(preview.plan.entryCount, 'entry', 'entries')}
          </button>
        {/if}
      </div>
    </section>
  {:else if view.step === 'importing'}
    <div class="progress" role="status">
      <p>Importing… {view.done.toLocaleString('en-US')} of {view.total.toLocaleString('en-US')}</p>
      <progress max={view.total} value={view.done} aria-label="Import progress"></progress>
      <p class="muted small">Keep this page open until it's done.</p>
    </div>
  {:else if view.step === 'finished'}
    <div class="result">
      <p role="status" data-testid="import-result">{resultText(view)}</p>
      <button type="button" class="button-secondary" onclick={reset}>Done</button>
    </div>
  {:else if view.step === 'failed'}
    <div class="result">
      <p class="notice" role="alert">{view.message}</p>
      <button type="button" class="button-secondary" onclick={reset}>OK</button>
    </div>
  {/if}
</div>

<style>
  .import,
  .preview,
  .progress,
  .result,
  .problems {
    display: grid;
    gap: var(--space-3);
  }

  p,
  h3,
  ul {
    margin: 0;
  }

  .file {
    position: relative;
    cursor: pointer;
  }

  /* The real file input is hidden; its label is the button, so show focus there. */
  .file:focus-within {
    outline: 2px solid var(--ink);
    outline-offset: 2px;
  }

  .preview {
    padding: var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: var(--raised);
  }

  .facts,
  .problems ul {
    display: grid;
    gap: var(--space-1);
    padding-left: var(--space-6);
  }

  .problems {
    max-height: 320px;
    overflow-y: auto;
  }

  /* Cancel, then the wider Import button (its label stays on one line). */
  .actions {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: var(--space-3);
  }

  .actions button {
    padding: 0 var(--space-3);
    white-space: nowrap;
  }

  progress {
    width: 100%;
    height: 8px;
    accent-color: var(--accent);
  }
</style>

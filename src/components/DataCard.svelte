<script lang="ts">
  import { Download } from '@lucide/svelte';
  import { APP } from '../lib/config';
  import { exportCsv } from '../lib/csv';
  import { listExercises, listSessions } from '../lib/data/logbook';
  import { localToday } from '../lib/model/dates';

  /**
   * Settings › Data: export every finished workout as a CSV file in the
   * sheet's format (import arrives in Story 21).
   */
  let busy = $state(false);
  let message = $state<{ text: string; problem: boolean } | null>(null);

  /** Saves `text` as a file through a temporary download link. */
  function download(text: string, name: string) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function exportAll() {
    busy = true;
    message = null;
    try {
      const [exercises, sessions] = await Promise.all([listExercises(), listSessions()]);
      const finished = sessions.filter((s) => s.status === 'finished').length;
      if (finished === 0) {
        message = { text: 'You have no finished workouts to export yet.', problem: false };
        return;
      }
      download(exportCsv(sessions, exercises), `${APP.name.toLowerCase()}-export-${localToday()}.csv`);
      message = { text: `Exported ${finished} ${finished === 1 ? 'entry' : 'entries'}.`, problem: false };
    } catch {
      message = { text: "Couldn't export. Check your connection and try again.", problem: true };
    } finally {
      busy = false;
    }
  }
</script>

<section class="card data" aria-labelledby="data-title">
  <h2 id="data-title" class="label">Data</h2>
  <p class="muted small">
    Download every finished workout as a CSV file: one row per exercise per workout, done sets only, in the same
    format as the original sheet.
  </p>
  <button type="button" class="button-secondary with-icon" disabled={busy} onclick={exportAll}>
    <Download size={18} aria-hidden="true" />
    {busy ? 'Exporting…' : 'Export CSV'}
  </button>
  {#if message}
    <p class={message.problem ? 'notice' : 'small'} role={message.problem ? 'alert' : 'status'}>{message.text}</p>
  {/if}
</section>

<style>
  .data {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4);
  }

  p,
  h2 {
    margin: 0;
  }

  button:disabled {
    opacity: 0.7;
    cursor: progress;
  }
</style>

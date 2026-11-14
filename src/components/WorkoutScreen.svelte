<script lang="ts">
  import { getWorkout, type WorkoutDetail } from '../lib/data/logbook';
  import { formatDayDate } from '../lib/format';
  import { localToday } from '../lib/model/dates';

  // Placeholder until Story 11 builds set entry: shows the workout's date
  // and exercises.
  let { id }: { id: string } = $props();
  let workout = $state<WorkoutDetail | null>(null);
  let error = $state(false);

  $effect(() => {
    getWorkout(id)
      .then((w) => (workout = w))
      .catch(() => (error = true));
  });
</script>

<section class="workout" aria-labelledby="workout-title">
  {#if error}
    <p class="notice" role="alert">Couldn't load this workout.</p>
  {:else if workout}
    <header>
      <p class="label">{workout.status === 'draft' ? 'Workout' : 'Finished workout'}</p>
      <h1 id="workout-title" class="display">{formatDayDate(workout.date, localToday())}</h1>
    </header>
    <ul class="pills" aria-label="Exercises">
      {#each workout.entries as entry (entry.id)}
        <li class="pill">{entry.exercise.name}</li>
      {/each}
    </ul>
    <p class="muted small">Set entry arrives in the next story.</p>
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
  }

  header p {
    margin: 0;
  }

  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .pill {
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--radius-pill);
    background: var(--surface);
    font-weight: 600;
  }

  p {
    margin: 0;
  }
</style>

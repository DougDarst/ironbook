<script lang="ts">
  import ChooseExercisesScreen from './ChooseExercisesScreen.svelte';
  import WorkoutScreen from './WorkoutScreen.svelte';
  import { findWorkoutByDate } from '../lib/data/logbook';
  import { localToday } from '../lib/model/dates';
  import { hrefForWorkout, router } from '../lib/state/router.svelte';

  // The Log tab: an open workout, or today's workout if there is one
  // (draft or finished), or else the exercise picker for today.
  let checked = $state(false);
  let error = $state(false);
  const today = localToday();

  $effect(() => {
    if (router.workoutId) return;
    checked = false;
    findWorkoutByDate(today)
      .then((workout) => {
        // Replace rather than push, so Back doesn't bounce off the Log tab.
        if (workout) window.location.replace(hrefForWorkout(workout.id));
        else checked = true;
      })
      .catch(() => (error = true));
  });
</script>

{#if router.workoutId}
  {#key router.workoutId}
    <WorkoutScreen id={router.workoutId} />
  {/key}
{:else if error}
  <p class="notice" role="alert">Couldn't load your workouts. Check your connection and reload.</p>
{:else if checked}
  <ChooseExercisesScreen {today} />
{:else}
  <p class="muted" aria-live="polite">Loading…</p>
{/if}

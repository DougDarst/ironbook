<script lang="ts">
  import { ArrowLeftRight, CalendarDays, Ellipsis, Minus, Plus, Trash2 } from '@lucide/svelte';
  import { hrefFor } from '../lib/state/router.svelte';

  /**
   * The Log screen's "•••" menu: change the workout (date, exercises, delete)
   * and, since the tab bar is hidden on this screen, the way to other screens.
   * Switch and Remove act on the exercise whose tab is selected.
   */
  let {
    onChangeDate,
    onAddExercise,
    onSwitchExercise,
    onRemoveExercise,
    onDelete,
    canAdd,
    canRemove,
  }: {
    onChangeDate: () => void;
    onAddExercise: () => void;
    onSwitchExercise: () => void;
    onRemoveExercise: () => void;
    onDelete: () => void;
    /** Below the 20-exercise limit. */
    canAdd: boolean;
    /** More than one exercise (a workout keeps at least one). */
    canRemove: boolean;
  } = $props();
  let open = $state(false);
  let root: HTMLDivElement | undefined = $state();

  function onDocumentClick(event: MouseEvent) {
    if (open && root && !root.contains(event.target as Node)) open = false;
  }

  /** Closes the menu, then runs the action. */
  const run = (action: () => void) => () => {
    open = false;
    action();
  };
</script>

<svelte:document onclick={onDocumentClick} onkeydown={(e) => e.key === 'Escape' && (open = false)} />

<div class="menu" bind:this={root}>
  <button
    type="button"
    class="header-button"
    aria-label="Workout options"
    aria-expanded={open}
    aria-controls="workout-menu"
    onclick={() => (open = !open)}
  >
    <Ellipsis size={22} aria-hidden="true" />
  </button>
  {#if open}
    <nav id="workout-menu" class="popover card" aria-label="Workout options">
      <button type="button" onclick={run(onChangeDate)}>
        <CalendarDays size={18} aria-hidden="true" />
        Change date
      </button>
      {#if canAdd}
        <button type="button" onclick={run(onAddExercise)}>
          <Plus size={18} aria-hidden="true" />
          Add exercise
        </button>
      {/if}
      <button type="button" onclick={run(onSwitchExercise)}>
        <ArrowLeftRight size={18} aria-hidden="true" />
        Switch exercise
      </button>
      {#if canRemove}
        <button type="button" onclick={run(onRemoveExercise)}>
          <Minus size={18} aria-hidden="true" />
          Remove exercise
        </button>
      {/if}
      <hr />
      <a href={hrefFor('history')} onclick={() => (open = false)}>History</a>
      <a href={hrefFor('settings')} onclick={() => (open = false)}>Settings</a>
      <hr />
      <button type="button" onclick={run(onDelete)}>
        <Trash2 size={18} aria-hidden="true" />
        Delete workout
      </button>
    </nav>
  {/if}
</div>

<style>
  .menu {
    position: relative;
  }

  .popover {
    position: absolute;
    top: calc(100% + var(--space-2));
    right: 0;
    z-index: 30;
    display: grid;
    min-width: 220px;
    padding: var(--space-1) 0;
  }

  hr {
    width: 100%;
    margin: var(--space-1) 0;
    border: 0;
    border-top: 1px solid var(--line);
  }

  a,
  button {
    gap: var(--space-2);
    width: 100%;
    border: 0;
    background: none;
    font: inherit;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    min-height: var(--tap);
    padding: 0 var(--space-4);
    color: var(--ink);
    font-weight: 600;
    text-decoration: none;
  }

  a:hover,
  button:hover {
    background: var(--raised);
  }
</style>

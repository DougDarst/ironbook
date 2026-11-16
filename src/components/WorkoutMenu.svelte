<script lang="ts">
  import { Ellipsis } from '@lucide/svelte';
  import { hrefFor } from '../lib/state/router.svelte';

  /**
   * The Log screen's "•••" menu. The tab bar is hidden on this screen, so
   * the menu is the way to other screens; the workout stays as it is.
   * (Delete workout joins it in Story 13.)
   */
  let open = $state(false);
  let root: HTMLDivElement | undefined = $state();

  function onDocumentClick(event: MouseEvent) {
    if (open && root && !root.contains(event.target as Node)) open = false;
  }
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
      <a href={hrefFor('history')} onclick={() => (open = false)}>History</a>
      <a href={hrefFor('metrics')} onclick={() => (open = false)}>Metrics</a>
      <a href={hrefFor('settings')} onclick={() => (open = false)}>Settings</a>
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
    min-width: 200px;
    padding: var(--space-1) 0;
  }

  a {
    display: flex;
    align-items: center;
    min-height: var(--tap);
    padding: 0 var(--space-4);
    color: var(--ink);
    font-weight: 600;
    text-decoration: none;
  }

  a:hover {
    background: var(--raised);
  }
</style>

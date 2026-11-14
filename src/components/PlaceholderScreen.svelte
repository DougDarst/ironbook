<script lang="ts">
  import { SCREEN_TITLES } from '../lib/nav';
  import type { Route } from '../lib/state/router.svelte';

  /** Stand-in for a screen that a later story builds. */
  let { route }: { route: Route } = $props();
</script>

<section class="placeholder" aria-labelledby="screen-title">
  <h1 id="screen-title" class="display laptop-only">{SCREEN_TITLES[route]}</h1>
  <div class="card">
    <p class="label">Coming soon</p>
    <p class="muted">This screen is built in a later story.</p>
  </div>
</section>

<style>
  .placeholder {
    display: grid;
    gap: var(--space-4);
  }

  .card {
    padding: var(--space-4);
  }

  .card p {
    margin: 0;
  }
</style>

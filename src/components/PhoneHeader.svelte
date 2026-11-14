<script lang="ts">
  import { Settings } from '@lucide/svelte';
  import { SCREEN_TITLES } from '../lib/nav';
  import { hrefFor, router } from '../lib/state/router.svelte';
</script>

<!-- iPhone header: the screen title, with Settings as a gear button. -->
<header class="phone-header">
  <h1 class="display">{SCREEN_TITLES[router.route]}</h1>
  <a
    class="header-button"
    href={hrefFor('settings')}
    aria-label="Settings"
    aria-current={router.route === 'settings' ? 'page' : undefined}
  >
    <Settings size={22} aria-hidden="true" />
  </a>
</header>

<style>
  .phone-header {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--header-height);
    padding: 0 var(--space-4);
    padding-top: env(safe-area-inset-top);
    box-sizing: content-box;
    background: var(--bg);
    border-bottom: 1px solid var(--line);
  }

  .header-button[aria-current='page'] {
    color: var(--accent);
  }
</style>

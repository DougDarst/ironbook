<script lang="ts">
  import { Settings } from '@lucide/svelte';
  import { APP } from '../lib/config';
  import { SCREEN_TITLES, TABS } from '../lib/nav';
  import { hrefFor, router } from '../lib/state/router.svelte';
  import { APP_VERSION } from '../lib/app-version';
</script>

<!-- Laptop navigation: app name, the main tabs and Settings in one bar. -->
<header class="topbar">
  <div class="inner">
    <a class="brand" href={hrefFor('log')}>{APP.name}</a>
    <nav aria-label="Main">
      {#each TABS as route (route)}
        <a href={hrefFor(route)} aria-current={router.route === route ? 'page' : undefined}>
          {SCREEN_TITLES[route]}
        </a>
      {/each}
    </nav>
    <div class="end">
      <span class="version small muted num">{APP_VERSION}</span>
      <a
        class="icon-button"
        href={hrefFor('settings')}
        aria-label="Settings"
        aria-current={router.route === 'settings' ? 'page' : undefined}
      >
        <Settings size={22} aria-hidden="true" />
      </a>
    </div>
  </div>
</header>

<style>
  .topbar {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }

  .inner {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    max-width: var(--content-max);
    height: var(--header-height);
    margin: 0 auto;
    padding: 0 var(--space-6);
  }

  .brand {
    font-family: var(--font-heading);
    font-weight: 700;
    font-size: 24px;
    text-transform: uppercase;
    color: var(--ink);
    text-decoration: none;
  }

  nav {
    display: flex;
    gap: var(--space-2);
    height: 100%;
  }

  nav a {
    display: flex;
    align-items: center;
    padding: 0 var(--space-3);
    font-weight: 600;
    color: var(--muted);
    text-decoration: none;
    border-bottom: 2px solid transparent;
  }

  nav a[aria-current='page'] {
    color: var(--ink);
    border-bottom-color: var(--accent);
  }

  .end {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    margin-left: auto;
  }

  .icon-button {
    color: var(--muted);
  }

  .icon-button[aria-current='page'] {
    color: var(--ink);
  }
</style>

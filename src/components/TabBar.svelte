<script lang="ts">
  import NavIcon from './NavIcon.svelte';
  import { SCREEN_TITLES, TABS } from '../lib/nav';
  import { hrefFor, router } from '../lib/state/router.svelte';
</script>

<!-- iPhone navigation: bottom tab bar, active item in the accent color. -->
<nav class="tabbar" aria-label="Main">
  {#each TABS as route (route)}
    <a href={hrefFor(route)} aria-current={router.route === route ? 'page' : undefined}>
      <NavIcon {route} />
      <span>{SCREEN_TITLES[route]}</span>
    </a>
  {/each}
</nav>

<style>
  .tabbar {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 10;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    height: var(--tabbar-height);
    padding-bottom: env(safe-area-inset-bottom);
    box-sizing: content-box;
    background: var(--surface);
    border-top: 1px solid var(--line);
  }

  a {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: var(--tap);
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
    text-decoration: none;
  }

  a[aria-current='page'] {
    color: var(--accent);
  }
</style>

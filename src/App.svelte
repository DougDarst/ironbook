<script lang="ts">
  import './app.css';
  import PhoneHeader from './components/PhoneHeader.svelte';
  import HistoryScreen from './components/HistoryScreen.svelte';
  import LogScreen from './components/LogScreen.svelte';
  import PlaceholderScreen from './components/PlaceholderScreen.svelte';
  import ReauthDialog from './components/ReauthDialog.svelte';
  import SettingsScreen from './components/SettingsScreen.svelte';
  import SignInScreen from './components/SignInScreen.svelte';
  import TabBar from './components/TabBar.svelte';
  import TopBar from './components/TopBar.svelte';
  import { onMount, untrack } from 'svelte';
  import { layout } from './lib/state/layout.svelte';
  import { router } from './lib/state/router.svelte';
  import { session } from './lib/state/session.svelte';
  import { theme } from './lib/state/theme.svelte';

  // Re-check the session with the server on every load (and the invite list
  // with it).
  onMount(() => void session.refresh());

  // Back in the foreground (e.g. switching back to the browser on the
  // phone): check the session hasn't ended meanwhile.
  function onVisibility() {
    if (document.visibilityState === 'visible') void session.check();
  }

  // The signed-in user's saved theme applies whenever the user changes.
  // Only the user is tracked: sync also reads the current theme, which must
  // not re-trigger it (that would undo a choice before it's saved).
  $effect(() => {
    const user = session.user;
    untrack(() => theme.sync(user));
  });
</script>

<!--
  Phone-first shell. Both navigations are rendered; CSS shows the phone
  header and tab bar below 768 px, and the top bar at laptop widths.
-->
<svelte:document onvisibilitychange={onVisibility} />

{#if session.user}
  <!-- The Log screens have their own header (date, actions). -->
  {#if router.route !== 'log'}
    <div class="phone-only"><PhoneHeader /></div>
  {/if}
  <div class="laptop-only"><TopBar /></div>

  <main>
    {#if router.route === 'log'}
      <LogScreen />
    {:else if router.route === 'history'}
      <HistoryScreen />
    {:else if router.route === 'settings'}
      <SettingsScreen />
    {:else}
      {#key router.route}
        <PlaceholderScreen route={router.route} />
      {/key}
    {/if}
  </main>

  {#if !layout.hideTabBar}
    <div class="phone-only"><TabBar /></div>
  {/if}
  <ReauthDialog />
{:else}
  <SignInScreen />
{/if}

<style>
  main {
    max-width: var(--content-max);
    margin: 0 auto;
    padding: var(--space-4);
    padding-bottom: calc(var(--tabbar-height) + env(safe-area-inset-bottom) + var(--space-6));
  }

  @media (min-width: 768px) {
    main {
      padding: var(--space-8) var(--space-6);
    }
  }

  :global(.laptop-only) {
    display: none;
  }

  @media (min-width: 768px) {
    :global(.phone-only) {
      display: none;
    }

    :global(.laptop-only) {
      display: revert;
    }
  }
</style>

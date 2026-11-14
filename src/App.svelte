<script lang="ts">
  import './app.css';
  import PhoneHeader from './components/PhoneHeader.svelte';
  import PlaceholderScreen from './components/PlaceholderScreen.svelte';
  import SettingsScreen from './components/SettingsScreen.svelte';
  import SignInScreen from './components/SignInScreen.svelte';
  import TabBar from './components/TabBar.svelte';
  import TopBar from './components/TopBar.svelte';
  import { onMount, untrack } from 'svelte';
  import { router } from './lib/state/router.svelte';
  import { session } from './lib/state/session.svelte';
  import { theme } from './lib/state/theme.svelte';

  // Re-check the session with the server on every load (and the invite list
  // with it).
  onMount(() => void session.refresh());

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
{#if session.user}
  <div class="phone-only"><PhoneHeader /></div>
  <div class="laptop-only"><TopBar /></div>

  <main>
    {#if router.route === 'settings'}
      <SettingsScreen />
    {:else}
      {#key router.route}
        <PlaceholderScreen route={router.route} />
      {/key}
    {/if}
  </main>

  <div class="phone-only"><TabBar /></div>
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

<script lang="ts">
  import { Dumbbell, Menu, Settings } from '@lucide/svelte';
  import type { Route } from '../lib/routes';

  /** The Lucide icon for a screen. Decorative: the label sits next to it. */
  let { route, size = 22 }: { route: Route; size?: number } = $props();

  const ICONS = { log: Dumbbell, history: Menu, settings: Settings };
  const Icon = $derived(ICONS[route]);
</script>

<Icon {size} aria-hidden="true" />

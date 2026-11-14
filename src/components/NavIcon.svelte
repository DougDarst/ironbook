<script lang="ts">
  import { ChartLine, Dumbbell, History, Settings } from '@lucide/svelte';
  import type { Route } from '../lib/state/router.svelte';

  /** The Lucide icon for a screen. Decorative: the label sits next to it. */
  let { route, size = 22 }: { route: Route; size?: number } = $props();

  const ICONS = { log: Dumbbell, history: History, metrics: ChartLine, settings: Settings };
  const Icon = $derived(ICONS[route]);
</script>

<Icon {size} aria-hidden="true" />

<script lang="ts">
  import { nearestPoint, volumeChart, type Range } from '../lib/chart';
  import { formatShortDate, formatVolume } from '../lib/format';

  /**
   * Volume per session for one lift: a line through its finished sessions,
   * placed by date, with volume PRs as filled accent dots. Tap or hover (or
   * use the arrow keys) to read a session's date and volume. Screen readers
   * get the same data as a table.
   */
  let {
    sessions,
    range,
    today,
    name,
  }: {
    sessions: readonly { date: string; volume: number; isPR: boolean }[];
    range: Range;
    today: string;
    name: string;
  } = $props();

  const HEIGHT = 220;
  let width = $state(0);
  const chart = $derived(
    volumeChart(sessions, range, today, { width: width || 320, height: HEIGHT, left: 44, right: 12, top: 12, bottom: 30 }),
  );

  let selected = $state<number | null>(null);
  const point = $derived(selected === null ? null : (chart.points[selected] ?? null));
  let root: HTMLDivElement | undefined = $state();

  const describe = (p: { date: string; volume: number; isPR: boolean }) =>
    `${formatShortDate(p.date, today)} · ${formatVolume(p.volume)}${p.isPR ? ' · PR' : ''}`;

  function pick(event: PointerEvent) {
    const box = (event.currentTarget as SVGElement).getBoundingClientRect();
    const index = nearestPoint(chart.points, event.clientX - box.left);
    selected = index >= 0 ? index : null;
  }

  /** Arrow keys step through the sessions; Escape hides the label. */
  function key(event: KeyboardEvent) {
    const last = chart.points.length - 1;
    if (last < 0) return;
    const moves: Record<string, number> = {
      ArrowRight: Math.min(last, (selected ?? -1) + 1),
      ArrowLeft: Math.max(0, (selected ?? last + 1) - 1),
      Home: 0,
      End: last,
    };
    if (event.key in moves) {
      event.preventDefault();
      selected = moves[event.key]!;
    } else if (event.key === 'Escape') {
      selected = null;
    }
  }

  // A tap outside the chart hides the label.
  function outside(event: PointerEvent) {
    if (selected !== null && root && !root.contains(event.target as Node)) selected = null;
  }
</script>

<svelte:document onpointerdown={outside} />

<!-- Focusable so keyboard users can step through the sessions with the arrow
     keys (the label is announced); screen readers also get the table below. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="chart"
  bind:this={root}
  bind:clientWidth={width}
  role="group"
  aria-label="{name}: volume per session chart. Use the arrow keys to read each session."
  tabindex="0"
  onkeydown={key}
  data-testid="volume-chart"
>
  <svg
    width={width || 320}
    height={HEIGHT}
    aria-hidden="true"
    onpointerdown={pick}
    onpointermove={(e) => e.pointerType === 'mouse' && pick(e)}
    onpointerleave={(e) => e.pointerType === 'mouse' && (selected = null)}
  >
    {#each chart.yTicks as tick (tick.value)}
      <line class="grid" x1={44} x2={(width || 320) - 12} y1={tick.y} y2={tick.y} />
      <text class="axis" x={36} y={tick.y} text-anchor="end" dominant-baseline="middle">{tick.label}</text>
    {/each}
    {#each chart.xTicks as tick (tick.date)}
      <text class="axis" x={tick.x} y={HEIGHT - 8} text-anchor="middle">{tick.label}</text>
    {/each}
    {#if point}
      <line class="guide" x1={point.x} x2={point.x} y1={12} y2={HEIGHT - 30} />
    {/if}
    <path class="line" d={chart.path} />
    {#each chart.points as p, i (p.date)}
      <circle
        class="dot"
        class:pr={p.isPR}
        class:selected={i === selected}
        cx={p.x}
        cy={p.y}
        r={i === selected ? 7 : 5}
        data-date={p.date}
      />
    {/each}
  </svg>

  {#if point}
    <p
      class="tip small num"
      style="left: {Math.min(Math.max(point.x, 70), (width || 320) - 70)}px; top: {point.y}px"
      data-testid="chart-tip"
    >
      {describe(point)}
    </p>
  {/if}
  <p class="visually-hidden" aria-live="polite">{point ? describe(point) : ''}</p>

  <table class="visually-hidden">
    <caption>{name}: volume per session</caption>
    <thead>
      <tr><th scope="col">Date</th><th scope="col">Volume</th><th scope="col">PR</th></tr>
    </thead>
    <tbody>
      {#each chart.points as p (p.date)}
        <tr><td>{formatShortDate(p.date, today)}</td><td>{formatVolume(p.volume)}</td><td>{p.isPR ? 'PR' : ''}</td></tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .chart {
    position: relative;
    width: 100%;
    touch-action: pan-y;
    border-radius: var(--radius-control);
  }

  .chart:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 4px;
  }

  svg {
    display: block;
    overflow: visible;
    font-family: var(--font-body);
    cursor: crosshair;
  }

  .grid {
    stroke: var(--line);
    stroke-width: 1;
  }

  .guide {
    stroke: var(--muted);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }

  .axis {
    fill: var(--muted);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .line {
    fill: none;
    stroke: var(--ink);
    stroke-width: 2;
    stroke-linejoin: round;
  }

  .dot {
    fill: var(--surface);
    stroke: var(--ink);
    stroke-width: 2;
  }

  .dot.pr {
    fill: var(--accent);
    stroke: var(--accent);
  }

  .tip {
    position: absolute;
    z-index: 1;
    margin: 0;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: var(--raised);
    color: var(--ink);
    font-weight: 600;
    white-space: nowrap;
    transform: translate(-50%, calc(-100% - 12px));
    pointer-events: none;
  }
</style>

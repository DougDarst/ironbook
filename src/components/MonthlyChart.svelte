<script lang="ts">
  import { monthlyChart, nearestPoint, type Range } from '../lib/chart';
  import { formatVolume } from '../lib/format';
  import { monthLabel } from '../lib/history';

  /**
   * Monthly total volume for one lift: a bar per month in the range, from
   * 0; the current (incomplete) month is a lighter bar. Tap or hover (or use
   * the arrow keys) to read a month. Screen readers get the data as a table.
   */
  let {
    totals,
    sessionsPerMonth,
    range,
    today,
    firstSession,
    name,
  }: {
    totals: readonly { month: string; volume: number; current: boolean }[];
    sessionsPerMonth: ReadonlyMap<string, number>;
    range: Range;
    today: string;
    firstSession: string;
    name: string;
  } = $props();

  const HEIGHT = 200;
  const LEFT = 44;
  const RIGHT = 4;
  let width = $state(0);
  const chart = $derived(
    monthlyChart(totals, sessionsPerMonth, range, today, firstSession, {
      width: width || 320,
      height: HEIGHT,
      left: LEFT,
      right: RIGHT,
      top: 22,
      bottom: 30,
    }),
  );

  let selected = $state<number | null>(null);
  const bar = $derived(selected === null ? null : (chart.bars[selected] ?? null));
  let root: HTMLDivElement | undefined = $state();
  const centers = $derived(chart.bars.map((b) => ({ x: b.x + b.width / 2 })));

  const sessionsText = (n: number) => `${n} ${n === 1 ? 'session' : 'sessions'}`;
  const describe = (b: { month: string; volume: number; sessions: number; current: boolean }) =>
    `${monthLabel(b.month)}${b.current ? ' so far' : ''} · ${formatVolume(b.volume)} · ${sessionsText(b.sessions)}`;

  function pick(event: PointerEvent) {
    const box = (event.currentTarget as SVGElement).getBoundingClientRect();
    const index = nearestPoint(centers, event.clientX - box.left);
    selected = index >= 0 ? index : null;
  }

  /** Arrow keys step through the months; Escape hides the label. */
  function key(event: KeyboardEvent) {
    const last = chart.bars.length - 1;
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

  const current = $derived(chart.bars.find((b) => b.current) ?? null);
</script>

<svelte:document onpointerdown={outside} />

<!-- Focusable so keyboard users can step through the months with the arrow
     keys (the label is announced); screen readers also get the table below. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="chart"
  bind:this={root}
  bind:clientWidth={width}
  role="group"
  aria-label="{name}: monthly total volume chart. Use the arrow keys to read each month."
  tabindex="0"
  onkeydown={key}
  data-testid="monthly-chart"
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
      <line class="grid" x1={LEFT} x2={(width || 320) - RIGHT} y1={tick.y} y2={tick.y} />
      <text class="axis" x={LEFT - 8} y={tick.y} text-anchor="end" dominant-baseline="middle">{tick.label}</text>
    {/each}
    {#each chart.bars as b, i (b.month)}
      {#if b.path}
        <path class="bar" class:current={b.current} class:selected={i === selected} d={b.path} data-month={b.month} />
      {/if}
      {#if b.valueLabel}
        <text class="value" x={b.x + b.width / 2} y={b.y - 6} text-anchor="middle">{b.valueLabel}</text>
      {/if}
      {#if b.monthLabel}
        <text class="axis" x={b.x + b.width / 2} y={HEIGHT - 8} text-anchor="middle">{b.monthLabel}</text>
      {/if}
    {/each}
  </svg>

  {#if bar}
    <p
      class="tip small num"
      style="left: {Math.min(Math.max(bar.x + bar.width / 2, 90), (width || 320) - 90)}px; top: {Math.min(bar.y, HEIGHT - 40)}px"
      data-testid="monthly-tip"
    >
      {describe(bar)}
    </p>
  {/if}
  <p class="visually-hidden" aria-live="polite">{bar ? describe(bar) : ''}</p>

  <!-- A wrapper hides the table: a table itself ignores the 1 px width and would widen the page. -->
  <div class="visually-hidden">
    <table>
      <caption>{name}: monthly total volume</caption>
      <thead>
        <tr><th scope="col">Month</th><th scope="col">Volume</th><th scope="col">Sessions</th></tr>
      </thead>
      <tbody>
        {#each chart.bars as b (b.month)}
          <tr>
            <td>{monthLabel(b.month)}{b.current ? ' (so far)' : ''}</td>
            <td>{formatVolume(b.volume)}</td>
            <td>{b.sessions}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
{#if current}
  <p class="muted small" data-testid="current-month-note">
    {monthLabel(current.month).split(' ')[0]} so far ({sessionsText(current.sessions)}).
  </p>
{/if}

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

  .axis,
  .value {
    fill: var(--muted);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .value {
    fill: var(--ink);
  }

  .bar {
    fill: var(--accent);
  }

  /* The current, incomplete month: a lighter bar, outlined so it shows on
     both themes' surfaces. */
  .bar.current {
    fill: var(--accent-soft);
    stroke: var(--accent);
    stroke-width: 1.5;
  }

  .bar.selected {
    stroke: var(--ink);
    stroke-width: 2;
  }

  p {
    margin: 0;
  }

  .tip {
    position: absolute;
    z-index: 1;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: var(--raised);
    color: var(--ink);
    font-weight: 600;
    white-space: nowrap;
    transform: translate(-50%, calc(-100% - 8px));
    pointer-events: none;
  }
</style>

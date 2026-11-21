<script lang="ts">
  import { nearestPoint, sessionChart, stepSelection } from '../lib/chart';
  import { formatVolume } from '../lib/format';
  import { shortDate } from '../lib/history';

  /**
   * History's "Volume per session" chart (redesign Story 4): a line through
   * every session in order, evenly spaced, volume PRs as green dots. Tap or
   * hover (or use the arrow keys) to read a session; screen readers get a
   * one-line summary and the sessions as a table.
   */
  let {
    sessions,
    name,
  }: { sessions: readonly { date: string; volume: number; isPR: boolean }[]; name: string } = $props();

  const HEIGHT = 170;
  const LEFT = 44;
  const RIGHT = 16;
  const BOTTOM = 30;
  let width = $state(0);
  const chart = $derived(
    sessionChart(sessions, { width: width || 320, height: HEIGHT, left: LEFT, right: RIGHT, top: 14, bottom: BOTTOM }),
  );

  let selected = $state<number | null>(null);
  const point = $derived(selected === null ? null : (chart.points[selected] ?? null));
  let root: HTMLDivElement | undefined = $state();

  const describe = (p: { date: string; volume: number; isPR: boolean }) =>
    `${shortDate(p.date)} · ${formatVolume(p.volume)}${p.isPR ? ' · PR' : ''}`;

  /** "Volume went from 19,200 on 7/2 to a high of 25,050 on 9/1; latest 23,300 on 9/22." */
  const summary = $derived.by(() => {
    const first = sessions[0];
    const last = sessions.at(-1);
    if (!first || !last) return '';
    const best = sessions.reduce((b, s) => (s.volume > b.volume ? s : b), first);
    return `Volume went from ${formatVolume(first.volume)} on ${shortDate(first.date)} to a high of ${formatVolume(best.volume)} on ${shortDate(best.date)}; latest ${formatVolume(last.volume)} on ${shortDate(last.date)}.`;
  });

  function pick(event: PointerEvent) {
    const box = (event.currentTarget as SVGElement).getBoundingClientRect();
    const index = nearestPoint(chart.points, event.clientX - box.left);
    selected = index >= 0 ? index : null;
  }

  function key(event: KeyboardEvent) {
    const next = stepSelection(event.key, selected, chart.points.length);
    if (next === undefined) return;
    event.preventDefault();
    selected = next;
  }

  // A tap outside the chart hides the label.
  function outside(event: PointerEvent) {
    if (selected !== null && root && !root.contains(event.target as Node)) selected = null;
  }
</script>

<svelte:document onpointerdown={outside} />

<section class="card trend" aria-labelledby="trend-title">
  <div class="head">
    <h2 id="trend-title" class="title">Volume per session</h2>
    <ul class="legend small muted" aria-hidden="true">
      <li><span class="key pr"></span>Volume PR</li>
      <li><span class="key"></span>Session</li>
    </ul>
  </div>

  <!-- Focusable so keyboard users can step through the sessions with the arrow
       keys (the label is announced); screen readers also get the table below. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="chart"
    bind:this={root}
    bind:clientWidth={width}
    role="group"
    aria-label="{name}: volume per session chart. {summary} Use the arrow keys to read each session."
    tabindex="0"
    onkeydown={key}
    data-testid="session-chart"
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
      {#each chart.xLabels as label (label.date)}
        <text class="axis" x={label.x} y={HEIGHT - 8} text-anchor="middle">{label.label}</text>
      {/each}
      {#if point}
        <line class="guide" x1={point.x} x2={point.x} y1={14} y2={HEIGHT - BOTTOM} />
      {/if}
      <path class="line" d={chart.path} />
      {#each chart.points as p, i (p.date)}
        <circle class="dot" class:pr={p.isPR} cx={p.x} cy={p.y} r={i === selected ? 8 : p.isPR ? 6 : 5} data-date={p.date} />
      {/each}
    </svg>

    {#if point}
      <p
        class="tip small num"
        style="left: {Math.min(Math.max(point.x, 70), (width || 320) - 70)}px; top: {point.y}px"
        data-testid="session-chart-tip"
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
        {#each sessions as s (s.date)}
          <tr><td>{shortDate(s.date)}</td><td>{formatVolume(s.volume)}</td><td>{s.isPR ? 'PR' : ''}</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<style>
  .trend {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-4) var(--space-4) var(--space-2);
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .legend {
    display: flex;
    gap: var(--space-4);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .legend li {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .key {
    width: 10px;
    height: 10px;
    border: 2px solid var(--muted);
    border-radius: 50%;
    background: var(--surface);
  }

  .key.pr {
    border-color: var(--pr-dot);
    background: var(--pr-dot);
  }

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
  }

  .guide {
    stroke: var(--muted);
    stroke-dasharray: 3 3;
  }

  .axis {
    fill: var(--muted);
    font-size: 11px;
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
    stroke: var(--muted);
    stroke-width: 2;
  }

  .dot.pr {
    fill: var(--pr-dot);
    stroke: var(--surface);
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

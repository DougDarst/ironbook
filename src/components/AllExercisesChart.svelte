<script lang="ts">
  import type { IndexSeries, PeriodDay } from '../lib/calc';
  import { indexChart, nearestPoint, stackedBars, stepSelection } from '../lib/chart';
  import { formatVolume } from '../lib/format';
  import { shortDate } from '../lib/history';

  /**
   * The All exercises chart (redesign Story 6), with a switch between
   * "Volume per workout" (a bar per workout day, a coloured segment per
   * lift, a green dot over days with a PR; tap, hover or arrow keys read a
   * day) and "Progress by lift" (each lift as a % of its first session in
   * the period; pick a lift in the legend, or hover its line, to bring it
   * forward). Screen readers get a summary and a table for each.
   */
  let {
    days,
    series,
    period,
    names,
    slots,
  }: {
    days: readonly PeriodDay[];
    series: readonly IndexSeries[];
    period: { start: string; end: string };
    names: ReadonlyMap<string, string>;
    /** Each lift's colour slot (1–8), or null for "Other". */
    slots: ReadonlyMap<string, number | null>;
  } = $props();

  let view = $state<'bars' | 'lines'>('bars');
  const HEIGHT = 240;
  const LEFT = 44;
  const RIGHT = 12;
  let width = $state(0);
  const frame = $derived({ width: width || 320, height: HEIGHT, left: LEFT, right: RIGHT, top: 18, bottom: 28 });

  const slotOf = (id: string) => slots.get(id) ?? null;
  const color = (id: string) => (slotOf(id) ? `var(--lift-${slotOf(id)})` : 'var(--lift-other)');
  const order = (id: string) => slotOf(id) ?? 99;
  const name = (id: string) => names.get(id) ?? '';

  /** The lifts in this period, in colour order (the legend). */
  const lifts = $derived(
    [...new Set(days.flatMap((d) => d.lifts.map((l) => l.exercise)))].sort((a, b) => order(a) - order(b)),
  );

  const bars = $derived(stackedBars(days, order, frame));
  const lines = $derived(indexChart(series, period, frame));

  let selected = $state<number | null>(null);
  const bar = $derived(selected === null ? null : (bars.bars[selected] ?? null));
  const day = $derived(selected === null ? null : (days[selected] ?? null));
  /** The lift brought forward in "Progress by lift". */
  let focusLift = $state<string | null>(null);
  let root: HTMLDivElement | undefined = $state();

  const describeDay = (d: PeriodDay) =>
    `${shortDate(d.date)} · ${[...d.lifts]
      .sort((a, b) => order(a.exercise) - order(b.exercise))
      .map((l) => `${name(l.exercise)} ${formatVolume(l.volume)}`)
      .join(' · ')}${d.hasPR ? ' · PR' : ''}`;

  const barsSummary = $derived.by(() => {
    if (days.length === 0) return 'No workouts in this period.';
    const top = days.reduce((b, d) => (d.total > b.total ? d : b), days[0]!);
    return `Volume per workout day, stacked by lift; highest ${formatVolume(top.total)} on ${shortDate(top.date)}.`;
  });
  const linesSummary = $derived(
    series.length === 0
      ? 'No lift has a session to compare in this period.'
      : `Each lift's session volume as a percent of its first session in the period: ${series
          .map((s) => `${name(s.exercise)} ${Math.round(s.points.at(-1)!.index)}%`)
          .join(', ')}.`,
  );

  function pick(event: PointerEvent) {
    const box = (event.currentTarget as SVGElement).getBoundingClientRect();
    const index = nearestPoint(
      bars.bars.map((b) => ({ x: b.x + b.width / 2 })),
      event.clientX - box.left,
    );
    selected = index >= 0 ? index : null;
  }

  function key(event: KeyboardEvent) {
    if (view !== 'bars') return;
    const next = stepSelection(event.key, selected, bars.bars.length);
    if (next === undefined) return;
    event.preventDefault();
    selected = next;
  }

  function outside(event: PointerEvent) {
    if (selected !== null && root && !root.contains(event.target as Node)) selected = null;
  }

  function show(next: 'bars' | 'lines') {
    view = next;
    selected = null;
    focusLift = null;
  }
</script>

<svelte:document onpointerdown={outside} />

<section class="card charts" aria-labelledby="all-chart-title">
  <div class="head">
    <h2 id="all-chart-title" class="title">
      {view === 'bars' ? 'Volume per workout, by lift' : 'Progress by lift · % of first session in the period'}
    </h2>
    <div class="switch" role="group" aria-label="Chart view">
      <button type="button" aria-pressed={view === 'bars'} onclick={() => show('bars')}>Volume per workout</button>
      <button type="button" aria-pressed={view === 'lines'} onclick={() => show('lines')}>Progress by lift</button>
    </div>
  </div>

  <ul class="legend small" aria-label="Lifts">
    {#each lifts as id (id)}
      <li>
        {#if view === 'lines' && series.some((s) => s.exercise === id)}
          <button
            type="button"
            class="legend-item"
            aria-pressed={focusLift === id}
            onclick={() => (focusLift = focusLift === id ? null : id)}
          >
            <span class="swatch" style="background: {color(id)}" aria-hidden="true"></span>{name(id)}
          </button>
        {:else}
          <span class="legend-item"><span class="swatch" style="background: {color(id)}" aria-hidden="true"></span>{name(id)}</span>
        {/if}
      </li>
    {/each}
    {#if view === 'bars'}
      <li><span class="legend-item"><span class="dot" aria-hidden="true"></span>PR that day</span></li>
    {/if}
  </ul>

  <!-- Focusable so keyboard users can step through the days with the arrow
       keys (the label is announced); screen readers also get the table below. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="chart"
    bind:this={root}
    bind:clientWidth={width}
    role="group"
    aria-label={view === 'bars' ? `${barsSummary} Use the arrow keys to read each day.` : linesSummary}
    tabindex="0"
    onkeydown={key}
    data-testid="all-chart"
  >
    {#if view === 'bars'}
      <svg
        width={width || 320}
        height={HEIGHT}
        aria-hidden="true"
        onpointerdown={pick}
        onpointermove={(e) => e.pointerType === 'mouse' && pick(e)}
        onpointerleave={(e) => e.pointerType === 'mouse' && (selected = null)}
      >
        {#each bars.yTicks as tick (tick.value)}
          <line class="grid" x1={LEFT} x2={(width || 320) - RIGHT} y1={tick.y} y2={tick.y} />
          <text class="axis" x={LEFT - 8} y={tick.y} text-anchor="end" dominant-baseline="middle">{tick.label}</text>
        {/each}
        {#each bars.bars as b, i (b.date)}
          <g class="bar" class:selected={i === selected} data-date={b.date} data-testid="day-bar">
            {#each b.segments as seg (seg.exercise)}
              <rect x={b.x} y={seg.y} width={b.width} height={seg.height} rx="2" fill={color(seg.exercise)} data-exercise={seg.exercise} />
            {/each}
            {#if b.hasPR}
              <circle class="pr-dot" cx={b.x + b.width / 2} cy={b.top - 9} r="5" />
            {/if}
          </g>
        {/each}
        {#each bars.xLabels as label (label.date)}
          <text class="axis" x={label.x} y={HEIGHT - 8} text-anchor="middle">{label.label}</text>
        {/each}
      </svg>
      {#if bar && day}
        <p
          class="tip small num"
          style="left: {Math.min(Math.max(bar.x + bar.width / 2, 120), (width || 320) - 120)}px; top: {bar.top - 14}px"
          data-testid="all-chart-tip"
        >
          {describeDay(day)}
        </p>
      {/if}
      <p class="visually-hidden" aria-live="polite">{day ? describeDay(day) : ''}</p>
      <table class="visually-hidden">
        <caption>Volume per workout day, by lift</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            {#each lifts as id (id)}<th scope="col">{name(id)}</th>{/each}
            <th scope="col">Total</th>
            <th scope="col">PR</th>
          </tr>
        </thead>
        <tbody>
          {#each days as d (d.date)}
            <tr>
              <td>{shortDate(d.date)}</td>
              {#each lifts as id (id)}
                {@const v = d.lifts.find((l) => l.exercise === id)}
                <td>{v ? formatVolume(v.volume) : ''}</td>
              {/each}
              <td>{formatVolume(d.total)}</td>
              <td>{d.hasPR ? 'PR' : ''}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <svg width={width || 320} height={HEIGHT} aria-hidden="true">
        {#each lines.yTicks as tick (tick.value)}
          <line class="grid" x1={LEFT} x2={(width || 320) - RIGHT} y1={tick.y} y2={tick.y} />
          <text class="axis" x={LEFT - 8} y={tick.y} text-anchor="end" dominant-baseline="middle">{tick.label}</text>
        {/each}
        <line class="baseline" x1={LEFT} x2={(width || 320) - RIGHT} y1={lines.baseline} y2={lines.baseline} />
        {#each lines.lines as line (line.exercise)}
          <g
            class="series"
            class:focus={focusLift === line.exercise}
            class:dim={focusLift !== null && focusLift !== line.exercise}
            data-exercise={line.exercise}
            data-testid="lift-line"
            onpointerenter={() => (focusLift = line.exercise)}
            onpointerleave={() => (focusLift = null)}
            role="presentation"
          >
            <path d={line.path} stroke={color(line.exercise)} />
            {#each line.points as p (p.date)}
              <circle cx={p.x} cy={p.y} r="3.5" fill={color(line.exercise)} />
            {/each}
          </g>
        {/each}
        {#each lines.xTicks as tick (tick.date)}
          <text class="axis" x={tick.x} y={HEIGHT - 8} text-anchor="middle">{tick.label}</text>
        {/each}
      </svg>
      <table class="visually-hidden">
        <caption>Progress by lift: session volume as a percent of the first session in the period</caption>
        <thead>
          <tr><th scope="col">Lift</th><th scope="col">Sessions</th><th scope="col">Latest</th></tr>
        </thead>
        <tbody>
          {#each series as s (s.exercise)}
            <tr><td>{name(s.exercise)}</td><td>{s.points.length}</td><td>{Math.round(s.points.at(-1)!.index)}%</td></tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</section>

<style>
  .charts {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4);
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  h2 {
    margin: 0;
  }

  .switch {
    display: flex;
    padding: 2px;
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: var(--raised);
  }

  .switch button {
    min-height: var(--tap);
    padding: 0 var(--space-4);
    border: 0;
    border-radius: 8px;
    background: none;
    font-size: 14px;
    font-weight: 600;
  }

  .switch button[aria-pressed='true'] {
    background: var(--ink);
    color: var(--bg);
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-4);
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--muted);
  }

  .legend-item {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 32px;
  }

  button.legend-item {
    min-height: var(--tap);
    padding: 0 var(--space-2);
    border: 1px solid transparent;
    border-radius: var(--radius-control);
    background: none;
    color: var(--muted);
    font-size: 13px;
  }

  button.legend-item[aria-pressed='true'] {
    border-color: var(--line);
    background: var(--raised);
    color: var(--ink);
    font-weight: 600;
  }

  .swatch {
    width: 12px;
    height: 12px;
    border-radius: 3px;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
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
  }

  .grid {
    stroke: var(--line);
  }

  .baseline {
    stroke: var(--muted);
    stroke-dasharray: 4 4;
  }

  .axis {
    fill: var(--muted);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  .bar {
    cursor: crosshair;
  }

  .bar.selected rect {
    stroke: var(--ink);
    stroke-width: 1.5;
  }

  .pr-dot {
    fill: var(--pr-dot);
  }

  .series path {
    fill: none;
    stroke-width: 2.5;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .series.focus path {
    stroke-width: 4;
  }

  .series.dim {
    opacity: 0.3;
  }

  .tip {
    position: absolute;
    z-index: 1;
    max-width: 260px;
    margin: 0;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: var(--raised);
    color: var(--ink);
    font-weight: 600;
    transform: translate(-50%, -100%);
    pointer-events: none;
  }
</style>

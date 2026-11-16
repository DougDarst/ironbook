<script lang="ts">
  import { Check } from '@lucide/svelte';
  import { canBeDone, nextField, type Field } from '../lib/entry';
  import { groupVolumes, setVolume } from '../lib/calc';
  import { formatVolume } from '../lib/format';
  import type { EntryEditor } from '../lib/state/entry-editor.svelte';

  /** The 20 set slots of one entry, in groups of 5, with fast keypad entry. */
  let { editor }: { editor: EntryEditor } = $props();

  const GROUP = 5;
  const groups = $derived(groupVolumes(editor.sets, GROUP));

  const inputId = (slot: number, field: Field) => `${editor.id}-${slot}-${field}`;

  // Tapping an input selects its contents. Safari clears a selection made
  // on focus when the tap's mouseup lands, so that first mouseup is ignored.
  let justFocused = false;

  function focus(event: FocusEvent, slot: number, field: Field) {
    editor.focused = { slot, field };
    const input = event.currentTarget as HTMLInputElement;
    justFocused = true;
    // Select now, so immediate typing replaces the value. Safari can drop a
    // selection made during focus, so select again after the frame, but
    // only if nothing has been typed yet (or it would select what was typed).
    const before = input.value;
    input.setSelectionRange(0, input.value.length);
    requestAnimationFrame(() => {
      if (document.activeElement === input && input.value === before) {
        input.setSelectionRange(0, input.value.length);
      }
    });
  }

  function mouseUp(event: MouseEvent) {
    if (justFocused) event.preventDefault();
    justFocused = false;
  }

  /** Next/Enter: weight → reps → next set's weight; closes the keypad after set 20. */
  function keyDown(event: KeyboardEvent, slot: number, field: Field) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const next = nextField(slot, field, editor.sets.length);
    if (next) document.getElementById(inputId(next.slot, next.field))?.focus();
    else (event.currentTarget as HTMLInputElement).blur();
  }
</script>

<div class="table" role="group" aria-label="Sets">
  <div class="columns label" aria-hidden="true">
    <span>Set</span>
    <span class="center">Lbs</span>
    <span></span>
    <span class="center">Reps</span>
    <span class="right">Vol</span>
    <span class="center">Done</span>
  </div>

  {#each groups as group, g (g)}
    {@const first = g * GROUP}
    <div class="group label num">
      <span>Sets {first + 1}–{first + GROUP}</span>
      <span>{formatVolume(group.done)} / {formatVolume(group.total)}</span>
    </div>

    {#each editor.sets.slice(first, first + GROUP) as set, k (first + k)}
      {@const slot = first + k}
      {@const n = slot + 1}
      {@const complete = canBeDone(set)}
      {@const error = editor.errors[slot]}
      <div class="row" class:done={set.done} data-testid="set-row-{n}">
        <span class="n num">{n}</span>
        <input
          id={inputId(slot, 'weight')}
          class="num"
          type="text"
          inputmode="decimal"
          enterkeyhint="next"
          autocomplete="off"
          aria-label="Set {n} weight, lbs"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${inputId(slot, 'weight')}-error` : undefined}
          value={editor.text[slot]!.weight}
          oninput={(e) => editor.type(slot, 'weight', e.currentTarget.value)}
          onfocus={(e) => focus(e, slot, 'weight')}
          onblur={() => editor.blur(slot, 'weight')}
          onmouseup={mouseUp}
          onkeydown={(e) => keyDown(e, slot, 'weight')}
        />
        <span class="times" aria-hidden="true">×</span>
        <input
          id={inputId(slot, 'reps')}
          class="num"
          type="text"
          inputmode="numeric"
          enterkeyhint={slot === editor.sets.length - 1 ? 'done' : 'next'}
          autocomplete="off"
          aria-label="Set {n} reps"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${inputId(slot, 'weight')}-error` : undefined}
          value={editor.text[slot]!.reps}
          oninput={(e) => editor.type(slot, 'reps', e.currentTarget.value)}
          onfocus={(e) => focus(e, slot, 'reps')}
          onblur={() => editor.blur(slot, 'reps')}
          onmouseup={mouseUp}
          onkeydown={(e) => keyDown(e, slot, 'reps')}
        />
        <span class="vol num">{complete ? formatVolume(setVolume(set)) : ''}</span>
        <button
          type="button"
          class="tick"
          aria-label="Set {n} done"
          aria-pressed={set.done}
          aria-disabled={complete ? undefined : 'true'}
          aria-describedby={complete ? undefined : 'tick-hint'}
          onclick={() => editor.toggleDone(slot)}
        >
          <Check size={20} strokeWidth={3} aria-hidden="true" />
        </button>
        {#if error}
          <p class="error small" id="{inputId(slot, 'weight')}-error" role="alert">Set {n}: {error}</p>
        {/if}
      </div>
    {/each}
  {/each}
  <p id="tick-hint" class="visually-hidden">Enter weight and reps first.</p>
</div>

<style>
  .table {
    border: 1px solid var(--line);
    border-radius: var(--radius-card);
    background: var(--surface);
  }

  .columns,
  .row {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) 14px minmax(0, 1fr) 56px var(--tap);
    align-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-3);
  }

  /* The column header stays pinned while scrolling (below the laptop top bar). */
  .columns {
    position: sticky;
    top: 0;
    z-index: 2;
    height: 44px;
    border-bottom: 1px solid var(--line);
    border-radius: var(--radius-card) var(--radius-card) 0 0;
    background: var(--raised);
  }

  @media (min-width: 768px) {
    .columns {
      top: var(--header-height);
    }
  }

  .center {
    text-align: center;
  }

  .right {
    text-align: right;
  }

  .group {
    display: flex;
    justify-content: space-between;
    padding: var(--space-3) var(--space-3) var(--space-2);
    border-bottom: 1px solid var(--line);
    background: var(--raised);
  }

  .row {
    min-height: var(--set-row);
    padding-top: 4px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--line);
  }

  .table > .row:last-of-type {
    border-bottom: 0;
    border-radius: 0 0 var(--radius-card) var(--radius-card);
  }

  .row.done {
    background: var(--done-tint);
  }

  .n {
    color: var(--muted);
  }

  input {
    width: 100%;
    min-width: 0;
    height: var(--tap);
    padding: 0 var(--space-1);
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: var(--raised);
    font-size: 19px;
    font-weight: 600;
    text-align: center;
  }

  .done input {
    border-color: var(--accent);
  }

  /* The field being edited: a 2 px ink outline (see the style guide). */
  input:focus {
    outline: 2px solid var(--ink);
    outline-offset: -1px;
  }

  input[aria-invalid='true'] {
    border-width: 2px;
    border-style: dashed;
  }

  .times {
    color: var(--muted);
    text-align: center;
  }

  .vol {
    color: var(--muted);
    text-align: right;
  }

  .tick {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--tap);
    height: var(--tap);
    padding: 0;
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: var(--surface);
    color: var(--muted);
  }

  .tick[aria-disabled='true'] {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .done .tick {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--on-accent);
  }

  .error {
    grid-column: 1 / -1;
    margin: 0 0 var(--space-1);
    font-weight: 600;
  }
</style>

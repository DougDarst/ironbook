<script lang="ts">
  /**
   * An in-page confirmation, built on the native <dialog> (focus moves into
   * it, Escape cancels, the page behind is inert).
   */
  let {
    open,
    title,
    message,
    confirmLabel,
    onConfirm,
    onCancel,
    busy = false,
  }: {
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
    busy?: boolean;
  } = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  // Unique ids, so each dialog on a page is named by its own title.
  const uid = $props.id();

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });
</script>

<dialog
  bind:this={dialog}
  class="card"
  aria-labelledby="{uid}-title"
  aria-describedby="{uid}-message"
  oncancel={(e) => {
    e.preventDefault();
    onCancel();
  }}
>
  <h2 id="{uid}-title" class="title">{title}</h2>
  <p id="{uid}-message">{message}</p>
  <div class="actions">
    <button type="button" class="button-secondary" onclick={onCancel}>Cancel</button>
    <button type="button" class="button-primary" disabled={busy} onclick={onConfirm}>{confirmLabel}</button>
  </div>
</dialog>

<style>
  dialog {
    width: min(400px, calc(100vw - 2 * var(--space-4)));
    padding: var(--space-6) var(--space-4) var(--space-4);
    color: var(--ink);
  }

  dialog::backdrop {
    background: rgb(0 0 0 / 0.5);
  }

  h2,
  p {
    margin: 0 0 var(--space-4);
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .actions button {
    padding: 0 var(--space-3);
    white-space: nowrap;
  }

  button:disabled {
    opacity: 0.7;
    cursor: progress;
  }
</style>

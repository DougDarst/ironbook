<script lang="ts">
  import { formatVolume } from '../lib/format';

  /**
   * A session's volume. A volume PR is set off in green, with a "PR" tag
   * before the number (the tag, not only the color, says so).
   */
  let { volume, isPR }: { volume: number; isPR: boolean } = $props();
</script>

<span class="volume num" class:pr={isPR} data-testid="volume">
  {#if isPR}<span class="pr-tag">PR</span>{/if}
  {formatVolume(volume)}
</span>

<style>
  .volume {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-2);
    padding: 7px 12px;
    border: 1px solid transparent;
    border-radius: 9px;
    font-size: 17px;
    font-weight: 700;
    line-height: 1.3;
    white-space: nowrap;
  }

  .pr {
    border-color: var(--pr-line);
    background: var(--pr-bg);
    color: var(--pr-ink);
  }
</style>

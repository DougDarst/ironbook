<script lang="ts">
  import { APP_VERSION } from '../lib/app-version';

  // Theme, import/export and sign out arrive in later stories (7, 20, 21).
</script>

<section class="settings" aria-labelledby="settings-title">
  <h1 id="settings-title" class="display laptop-only">Settings</h1>
  <div class="card">
    <dl>
      <div class="row">
        <dt class="label">Version</dt>
        <dd class="num" data-testid="app-version">{APP_VERSION}</dd>
      </div>
    </dl>
  </div>
</section>

<style>
  .settings {
    display: grid;
    gap: var(--space-4);
  }

  dl {
    margin: 0;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    min-height: var(--tap);
    padding: 0 var(--space-4);
  }

  dd {
    margin: 0;
  }
</style>

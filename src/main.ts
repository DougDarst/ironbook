import { mount } from 'svelte';
import App from './App.svelte';
import { theme } from './lib/state/theme.svelte';

// Apply the remembered theme before the first paint, so there's no flash.
theme.apply();

const app = mount(App, { target: document.getElementById('app')! });

export default app;

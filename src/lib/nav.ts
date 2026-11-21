import type { Route } from './routes';

/** Screen titles, shared by the headers and the navigation. */
export const SCREEN_TITLES: Record<Route, string> = {
  log: 'Log',
  history: 'History',
  settings: 'Settings',
};

/** The main tabs: the iPhone tab bar and the laptop top bar. */
export const TABS: readonly Route[] = ['log', 'history'];

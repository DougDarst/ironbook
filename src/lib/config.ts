/**
 * The app's name. This is the ONLY place it is defined: the page title,
 * header, README instructions and everything else read it from here. To
 * rename the app, change this value (see "Renaming the app" in the README).
 */
export const APP = {
  name: 'Ironbook',
} as const;

/**
 * Major and minor version, set by hand. The patch number (commit count) and
 * commit hash are stamped at build time; see src/lib/version.ts.
 */
export const VERSION = {
  major: 0,
  minor: 1,
} as const;

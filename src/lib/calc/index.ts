/**
 * Everything computed from what the user enters: volume, change vs last
 * time, PRs, monthly totals. Nothing here is stored. Only done sets count
 * (provisional; see docs/TODO.md), and only finished workouts count.
 */
export * from './volume';
export * from './history';
export * from './monthly';

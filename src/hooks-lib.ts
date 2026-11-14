/**
 * Entry point for the code shared with the PocketBase hooks. Bundled by
 * `npm run build:hooks` into pb_hooks/generated/shared.cjs (git-ignored),
 * which the hooks `require`. Must stay dependency-free.
 */
export {
  isValidDate,
  MAX_EXERCISE_NAME,
  MAX_EXERCISES_PER_WORKOUT,
  normalizeExerciseName,
  validateSets,
} from './lib/model';

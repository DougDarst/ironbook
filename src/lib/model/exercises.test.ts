import { describe, expect, it } from 'vitest';
import { normalizeExerciseName } from './exercises';

describe('normalizeExerciseName', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeExerciseName('  Barbell   Bench\tPress \n')).toBe('Barbell Bench Press');
  });

  it('keeps case and punctuation', () => {
    expect(normalizeExerciseName('DB Row (1-arm)')).toBe('DB Row (1-arm)');
  });

  it('turns nothing into an empty name', () => {
    expect(normalizeExerciseName('   ')).toBe('');
    expect(normalizeExerciseName(null)).toBe('');
  });
});

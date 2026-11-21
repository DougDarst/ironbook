import { describe, expect, it } from 'vitest';
import { scrollDelta } from './viewport';

// Keeping the field being typed in above the iPhone keyboard.

describe('scrollDelta', () => {
  // A 844 px tall phone with the keyboard up: 470 px still visible.
  const area = { top: 0, height: 470 };

  it('leaves a field that already fits', () => {
    expect(scrollDelta({ top: 200, bottom: 244 }, area, 44)).toBe(0);
  });

  it('scrolls down to lift a field out from under the keyboard, with a margin', () => {
    // Set 16 at 600–644 px: its bottom must come up to 470 − 16 = 454.
    expect(scrollDelta({ top: 600, bottom: 644 }, area, 44)).toBe(190);
  });

  it('scrolls up when a field is under the pinned header', () => {
    expect(scrollDelta({ top: 20, bottom: 64 }, area, 44)).toBe(-24);
  });

  it('keeps the top of a field that is taller than the space', () => {
    expect(scrollDelta({ top: 600, bottom: 1100 }, area, 44)).toBe(556); // top lands just under the header
  });

  it('works with a visual viewport that has scrolled (offsetTop)', () => {
    const scrolled = { top: 300, height: 470 };
    expect(scrollDelta({ top: 760, bottom: 804 }, scrolled, 44)).toBe(804 - (300 + 470 - 16)); // 50
    expect(scrollDelta({ top: 700, bottom: 744 }, scrolled, 44)).toBe(0); // fits: 744 ≤ 754
    expect(scrollDelta({ top: 400, bottom: 444 }, scrolled, 44)).toBe(0);
  });
});

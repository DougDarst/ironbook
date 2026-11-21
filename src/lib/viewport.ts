/**
 * Keeping the field being typed in visible above the on-screen keyboard
 * (spec Decisions, 2026-11-20). On iPhone the keyboard shrinks the *visual*
 * viewport, not the page, so the browser's own scrolling can leave a field
 * under it. This is the pure part, unit-tested in viewport.test.ts; the Log
 * screen's SetsTable applies it when the keyboard opens.
 */

export interface VisibleArea {
  /** Top of the visible area, in the same coordinates as the field's box. */
  top: number;
  height: number;
}

/**
 * How far to scroll the page (positive: down) so that a field with box
 * `top`..`bottom` sits inside the visible area, at least `margin` from its
 * bottom (the keyboard) and `topInset` below its top (a pinned header).
 * 0 when it already fits; when it can't fit, its top wins.
 */
export function scrollDelta(field: { top: number; bottom: number }, area: VisibleArea, topInset = 0, margin = 16): number {
  const minTop = area.top + topInset;
  const maxBottom = area.top + area.height - margin;
  if (field.top < minTop) return field.top - minTop;
  if (field.bottom > maxBottom) return Math.min(field.bottom - maxBottom, field.top - minTop);
  return 0;
}

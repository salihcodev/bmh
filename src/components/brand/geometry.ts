// Brand mark geometry in a 100x100 box: an open hand with a heart in the palm.
// Shared by the in-app SVG (brand-mark.tsx) and scripts/generate-brand-assets.mts, so the
// app icon, splash and in-app mark are the same drawing. Plain data only (no imports).

export type Capsule = { kind: 'capsule'; x1: number; y1: number; x2: number; y2: number; r: number };
export type RoundRect = { kind: 'rect'; x: number; y: number; w: number; h: number; r: number };
export type Circle = { kind: 'circle'; cx: number; cy: number; r: number };
/** Square of side `s` centered at (cx, cy), rotated 45 degrees. */
export type Diamond = { kind: 'diamond'; cx: number; cy: number; s: number };
export type Shape = Capsule | RoundRect | Circle | Diamond;

export const HAND: Shape[] = [
  { kind: 'rect', x: 27, y: 46, w: 46, h: 38, r: 15 },
  { kind: 'capsule', x1: 32.5, y1: 26, x2: 32.5, y2: 56, r: 5 },
  { kind: 'capsule', x1: 44.2, y1: 18, x2: 44.2, y2: 56, r: 5 },
  { kind: 'capsule', x1: 55.8, y1: 20, x2: 55.8, y2: 56, r: 5 },
  { kind: 'capsule', x1: 67.5, y1: 28, x2: 67.5, y2: 56, r: 5 },
  { kind: 'capsule', x1: 31, y1: 70, x2: 17, y2: 52, r: 5.5 },
];

/** Cut out of the palm (drawn in the background color). */
export const HEART: Shape[] = [
  { kind: 'circle', cx: 45.8, cy: 62, r: 5.2 },
  { kind: 'circle', cx: 54.2, cy: 62, r: 5.2 },
  { kind: 'diamond', cx: 50, cy: 65.6, s: 11.6 },
];

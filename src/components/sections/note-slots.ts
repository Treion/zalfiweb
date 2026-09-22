import type { NoteLayer } from "@/lib/fragrance";

/**
 * Where notes float around the bottle, as offsets from the viewport centre.
 * x in vw, y in vh, size in vw. depth drives scroll + pointer parallax; far notes get a static
 * depth-of-field blur (never animated).
 */
export type Slot = { x: number; y: number; size: number; depth: number; far?: boolean };

export const NOTE_SLOTS: Record<"desktop" | "mobile", Record<NoteLayer, Slot[]>> = {
  desktop: {
    top: [
      { x: -26, y: -23, size: 11, depth: 1 },
      { x: 24, y: -27, size: 9, depth: 0.6 },
      { x: 12, y: -41, size: 6, depth: 0.25, far: true },
    ],
    heart: [
      { x: 30, y: -3, size: 11.5, depth: 1 },
      { x: -33, y: -4, size: 9, depth: 0.6 },
      { x: -15, y: -41, size: 6, depth: 0.25, far: true },
    ],
    base: [
      { x: -25, y: 12, size: 10, depth: 1 },
      { x: 27, y: 17, size: 9, depth: 0.6 },
      { x: 40, y: -21, size: 6, depth: 0.25, far: true },
    ],
  },
  mobile: {
    top: [
      { x: -36, y: -21, size: 19, depth: 1 },
      { x: 37, y: -26, size: 17, depth: 0.6 },
    ],
    heart: [
      { x: 37, y: -3, size: 19, depth: 1 },
      { x: -37, y: 1, size: 17, depth: 0.6 },
    ],
    base: [
      { x: -36, y: 16, size: 18, depth: 1 },
      { x: 36, y: 15, size: 17, depth: 0.6 },
    ],
  },
};

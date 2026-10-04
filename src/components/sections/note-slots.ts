import type { NoteLayer } from "@/lib/fragrance";

/**
 * Where notes float around the bottle, as offsets from the viewport centre.
 * x in vw, y in vh, size in vw. depth drives the scroll parallax; far notes get a static
 * depth-of-field blur (never animated).
 */
export type Slot = { x: number; y: number; size: number; depth: number; far?: boolean };

export const NOTE_SLOTS: Record<"desktop" | "mobile", Record<NoteLayer, Slot[]>> = {
  desktop: {
    top: [
      { x: -26, y: -23, size: 12.5, depth: 1 },
      { x: 24, y: -27, size: 10.5, depth: 0.6 },
      { x: 38, y: -35, size: 7, depth: 0.25, far: true },
    ],
    heart: [
      { x: 30, y: -3, size: 13, depth: 1 },
      { x: -33, y: -4, size: 10.5, depth: 0.6 },
      { x: -40, y: -17, size: 7, depth: 0.25, far: true },
    ],
    base: [
      { x: -25, y: 13, size: 11.5, depth: 1 },
      { x: 27, y: 17, size: 10.5, depth: 0.6 },
      { x: 40, y: -21, size: 7, depth: 0.25, far: true },
    ],
  },
  mobile: {
    top: [
      { x: -36, y: -23, size: 22, depth: 1 },
      { x: 37, y: -27, size: 20, depth: 0.6 },
    ],
    heart: [
      { x: 37, y: -3, size: 22, depth: 1 },
      { x: -37, y: 0, size: 20, depth: 0.6 },
    ],
    base: [
      { x: -36, y: 18, size: 21, depth: 1 },
      { x: 36, y: 16, size: 20, depth: 0.6 },
    ],
  },
};

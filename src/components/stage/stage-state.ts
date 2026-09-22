/**
 * Mutable state shared by GSAP (writer) and the WebGL render loop (reader).
 * Deliberately NOT React state: it changes every frame and must never trigger re-renders.
 */
export const stageState = {
  /** Smoothed scroll position through the home experience, in vh units (written by the GSAP scrub) */
  s: 0,
  /** Length multiplier for the experience (1 desktop, MOBILE_SCALE mobile) */
  k: 1,
  /** Pointer in -1..1 (x right, y up), raw; the stage damps it */
  pointer: { x: 0, y: 0 },
  /** Collection slot index under the pointer / focus, or -1 */
  collectionHover: -1,
  /** Ready flags set by the stage as textures load */
  ready: false,
  bottleReady: [] as boolean[],
};

export type StageState = typeof stageState;

if (typeof window !== "undefined") {
  window.addEventListener(
    "pointermove",
    (e) => {
      stageState.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      stageState.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    },
    { passive: true },
  );
}

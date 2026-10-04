/**
 * Mutable state shared by GSAP (writer) and the WebGL render loop (reader).
 * Deliberately NOT React state: it changes every frame and must never trigger re-renders.
 */
export const stageState = {
  /** Smoothed scroll position through the home experience, in vh units (written by the GSAP scrub) */
  s: 0,
  /** Length multiplier for the experience (1 desktop, MOBILE_SCALE mobile) */
  k: 1,
  /** Line-up slot index under the pointer / focus, or -1 */
  collectionHover: -1,
  /** Chapter whose bottle is under the pointer (or whose Discover link has focus), or -1 */
  chapterHover: -1,
  /** Product page: rotation (radians) the visitor has dragged the 3D bottle to */
  spin: 0,
  /** Ready flags set by the stage as textures load */
  ready: false,
  bottleReady: [] as boolean[],
  /** The stage keeps drawing until this time (performance.now() ms), e.g. after a texture loads */
  awakeUntil: 0,
};

/** Something changed that the scroll and anchors can't show (a texture arrived): draw for a while */
export function wakeStage(ms = 1500) {
  stageState.awakeUntil = Math.max(stageState.awakeUntil, performance.now() + ms);
}

export type StageState = typeof stageState;

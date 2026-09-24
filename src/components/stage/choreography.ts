/**
 * Pure functions of scroll position → what the stage shows. No state and no side effects, so
 * the scene is perfectly reversible and always in sync with the DOM timeline built from the same
 * config (see config.ts).
 */
import {
  CHAPTER_COUNT,
  EXP,
  chRange,
  easeInOutCubic,
  easeOutExpo,
  expTotal,
  heroStart,
  prog,
  smooth,
} from "./config";

export type Pose = {
  /** Offset from the anchor centre, px (world units, y up) */
  dx: number;
  dy: number;
  rotZ: number;
  rotY: number;
  scale: number;
  opacity: number;
  /** Light sweep position 0..1.2 (0 = none) */
  sweep: number;
  /** 0..1 how "grounded" on the floor (drives reflection/shadow) */
  grounded: number;
};

const HIDDEN: Pose = {
  dx: 0,
  dy: 0,
  rotZ: 0,
  rotY: 0,
  scale: 1,
  opacity: 0,
  sweep: 0,
  grounded: 0,
};
const DEG = Math.PI / 180;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Pose of fragrance i's bottle in the home experience at scroll position s (vh units). */
export function bottlePose(s: number, i: number, k: number, vw: number, vh: number): Pose {
  const riseRange: [number, number] =
    i === 0
      ? [heroStart(k) + EXP.hero_.rise[0] * k, heroStart(k) + EXP.hero_.rise[1] * k]
      : chRange(i, EXP.ch.enter, k);
  const exitRange = chRange(i, EXP.ch.exit, k);

  const e = easeOutCubic(prog(s, ...riseRange));
  const x = easeInOutCubic(prog(s, ...exitRange));
  if (e <= 0 || x >= 1) return HIDDEN;

  const inv = 1 - e;
  // Enter: rises from below-right, turning into the light. The hero bottle rises straight up.
  const enterDx = i === 0 ? 0 : inv * vw * 0.26;
  const enterDy = -inv * vh * (i === 0 ? 0.95 : 0.8);
  const enterRotZ = i === 0 ? 0 : inv * 9 * DEG;
  const enterRotY = -inv * (i === 0 ? 16 : 26) * DEG;
  // Exit: lifts away up-left while the next bottle arrives
  const exitDx = -x * vw * 0.3;
  const exitDy = x * vh * 0.72;
  const exitRotZ = -x * 8 * DEG;
  const exitRotY = x * 22 * DEG;

  const chapterP = prog(s, ...chRange(i, [0, EXP.chapter], k));
  const breathe = 1 + Math.sin(chapterP * Math.PI) * 0.018;

  const [rs] = riseRange;
  const riseEnd = riseRange[1];
  // One slow, faint pass of light as the bottle lands, and nothing after that
  const sweepA = prog(s, riseEnd - 12 * k, riseEnd + 90 * k);
  const sweep = sweepA > 0 && sweepA < 1 ? sweepA * 1.2 : 0;

  return {
    dx: enterDx + exitDx,
    dy: enterDy + exitDy,
    rotZ: enterRotZ + exitRotZ,
    rotY: enterRotY + exitRotY,
    scale: (0.9 + 0.1 * e) * breathe,
    opacity: smooth(prog(s, rs, rs + (riseEnd - rs) * 0.45)) * (1 - smooth(prog(x, 0.5, 1))),
    sweep,
    grounded: e * (1 - Math.min(1, x * 3)),
  };
}

/**
 * World blend: 0 = house (noir), 1..6 = fragrance worlds. Returns [index a, index b, mix, houseMix]
 * so the renderer can blend two palettes and pull back to the house at the end.
 */
export function worldBlend(
  s: number,
  k: number,
): { from: number; to: number; t: number; house: number } {
  let w = 0;
  for (let i = 0; i < CHAPTER_COUNT; i++) w += smooth(prog(s, ...chRange(i, EXP.ch.world, k)));
  const total = expTotal(k);
  const back = smooth(prog(s, total - EXP.outro * k - 30 * k, total - 10 * k));
  const from = Math.floor(w);
  return { from, to: Math.min(CHAPTER_COUNT, from + 1), t: w - from, house: back };
}

/** Masthead (giant fragrance name behind the bottle) for chapter i. */
export function mastheadState(s: number, i: number, k: number) {
  const reveal = easeOutExpo(prog(s, ...chRange(i, EXP.ch.masthead, k)));
  const out = smooth(prog(s, ...chRange(i, EXP.ch.mastheadOut, k)));
  return { reveal, opacity: reveal > 0 ? 1 - out : 0, lift: (1 - reveal) * 0.12 + out * -0.08 };
}

/** 0..1 progress through chapter i (used for the scrubbed 3D turntable). */
export function chapterProgress(s: number, i: number, k: number) {
  return prog(s, ...chRange(i, [0, EXP.chapter], k));
}

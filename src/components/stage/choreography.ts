/**
 * Pure functions of scroll position → what the stage shows. No state and no side effects, so
 * the scene is perfectly reversible and always in sync with the DOM timeline built from the same
 * config (see config.ts).
 */
import {
  CHAPTER_COUNT,
  EXP,
  chRange,
  easeInOutSine,
  easeOutCubic,
  easeOutQuad,
  expTotal,
  lineupStart,
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
  /** 0..1 how "grounded" on the floor (drives reflection/shadow) */
  grounded: number;
};

const HIDDEN: Pose = { dx: 0, dy: 0, rotZ: 0, rotY: 0, scale: 1, opacity: 0, grounded: 0 };
const DEG = Math.PI / 180;

/**
 * Pose of fragrance i's bottle in its chapter of the home experience, at scroll position s (vh
 * units). Reva (i = 0) has no entrance of its own: it glides in from the line-up (lineupState).
 */
export function bottlePose(s: number, i: number, k: number, vw: number, vh: number): Pose {
  const exitRange = chRange(i, EXP.ch.exit, k);
  const xp = prog(s, ...exitRange);
  const x = easeInOutSine(xp);
  // Exit: lifts a little and dissolves before the next bottle settles. No swoop.
  const exitDx = -x * vw * 0.03;
  const exitDy = x * vh * 0.35;
  const exitRotZ = -x * 1.5 * DEG;
  const exitRotY = x * 6 * DEG;
  const chapterP = prog(s, ...chRange(i, [0, EXP.chapter], k));
  const breathe = 1 + Math.sin(chapterP * Math.PI) * 0.018;
  const fadeOut = 1 - smooth(prog(xp, 0.35, 1));

  if (i === 0) {
    if (xp >= 1) return HIDDEN;
    return {
      dx: exitDx,
      dy: exitDy,
      rotZ: exitRotZ,
      rotY: exitRotY,
      scale: breathe,
      opacity: fadeOut,
      grounded: 1 - Math.min(1, xp * 3),
    };
  }

  const riseRange = chRange(i, EXP.ch.enter, k);
  const e = easeOutCubic(prog(s, ...riseRange));
  if (e <= 0 || xp >= 1) return HIDDEN;

  const inv = 1 - e;
  // Enter: rises gently from just below, barely turning
  const enterDx = inv * vw * 0.04;
  const enterDy = -inv * vh * 0.4;
  const enterRotZ = inv * 2 * DEG;
  const enterRotY = -inv * 8 * DEG;

  const [rs, riseEnd] = riseRange;
  return {
    dx: enterDx + exitDx,
    dy: enterDy + exitDy,
    rotZ: enterRotZ + exitRotZ,
    rotY: enterRotY + exitRotY,
    scale: (0.94 + 0.06 * e) * breathe,
    opacity: smooth(prog(s, rs, rs + (riseEnd - rs) * 0.55)) * fadeOut,
    grounded: e * (1 - Math.min(1, xp * 3)),
  };
}

/**
 * The line-up at scroll position s:
 *  - `arrive` (0..1) is bottle i rising into its slot as the landing logo leaves. The DOM tween moves
 *    the slot itself (the stage follows its rect); this is the matching opacity, with the same ease
 *    (EASE.soft, power2.out).
 *  - `handoff` (eased 0..1) carries Reva from its place in the line-up into its chapter.
 *  - `fade` (0..1) dissolves each of the other five, one after another.
 */
export function lineupState(s: number, i: number, k: number) {
  const L = EXP.lineup_;
  const o = lineupStart(k);
  const a0 = o + (L.arrive[0] + i * L.stagger) * k;
  return {
    arrive: easeOutQuad(prog(s, a0, a0 + (L.arrive[1] - L.arrive[0]) * k)),
    handoff: easeInOutSine(prog(s, o + L.handoff[0] * k, o + L.handoff[1] * k)),
    fade: smooth(prog(s, o + (L.fade[0] + (i - 1) * 4) * k, o + L.fade[1] * k)),
  };
}

/**
 * How open the line-up is to hover (0..1): it opens as the last bottles land and closes as its
 * words leave. Hover previews (the world colour, the lift) scale with it.
 */
export function lineupOpen(s: number, k: number) {
  const o = lineupStart(k);
  const L = EXP.lineup_;
  return prog(s, o - 16 * k, o) * (1 - prog(s, o + L.textOut[0] * k, o + L.textOut[1] * k));
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
  const reveal = easeOutCubic(prog(s, ...chRange(i, EXP.ch.masthead, k)));
  const out = smooth(prog(s, ...chRange(i, EXP.ch.mastheadOut, k)));
  return { reveal, opacity: reveal > 0 ? 1 - out : 0, lift: (1 - reveal) * 0.12 + out * -0.08 };
}

/** 0..1 progress through chapter i (used for the scrubbed 3D turntable). */
export function chapterProgress(s: number, i: number, k: number) {
  return prog(s, ...chRange(i, [0, EXP.chapter], k));
}

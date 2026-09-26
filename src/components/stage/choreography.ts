/**
 * Pure functions of scroll position → what the stage shows. No state and no side effects, so
 * the scene is perfectly reversible and always in sync with the DOM timeline built from the same
 * config (see config.ts).
 */
import {
  CHAPTER_COUNT,
  EXP,
  INTRO_POSE,
  chRange,
  easeInOutSine,
  easeOutCubic,
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
  /** 0..1 how "grounded" on the floor (drives reflection/shadow) */
  grounded: number;
};

const HIDDEN: Pose = { dx: 0, dy: 0, rotZ: 0, rotY: 0, scale: 1, opacity: 0, grounded: 0 };
const DEG = Math.PI / 180;

/**
 * Pose of fragrance i's bottle in the home experience at scroll position s (vh units).
 * `intro` (0..1) is the one-time load morph: the hero bottle arrives on the landing screen as the
 * logo's emblem grows into it, then scroll settles it into the hero.
 */
export function bottlePose(
  s: number,
  i: number,
  k: number,
  vw: number,
  vh: number,
  intro = 1,
): Pose {
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
    if (intro <= 0 || xp >= 1) return HIDDEN;
    const h = heroStart(k);
    const settle = easeInOutSine(prog(s, h + EXP.hero_.settle[0] * k, h + EXP.hero_.settle[1] * k));
    return {
      dx: exitDx,
      dy: (1 - settle) * INTRO_POSE.lift * vh + exitDy,
      rotZ: exitRotZ,
      rotY: exitRotY,
      scale: (INTRO_POSE.scale + (1 - INTRO_POSE.scale) * settle) * (0.94 + 0.06 * intro) * breathe,
      opacity: intro * fadeOut,
      // It floats above the wordmark on landing, and meets the floor as it settles
      grounded: intro * settle * (1 - Math.min(1, xp * 3)),
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

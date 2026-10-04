/**
 * Pure functions of scroll position → what the stage shows. No state and no side effects, so
 * the scene is perfectly reversible and always in sync with the DOM timeline built from the same
 * config (see config.ts).
 */
import {
  chapterCount,
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
 *
 * The hand-over is a dissolve, never a crossing: the outgoing bottle lifts a little and is gone
 * before the incoming one shows, rising gently into the same place. Small, vertical moves only.
 */
export function bottlePose(s: number, i: number, k: number, vh: number): Pose {
  const C = EXP.ch;
  const xp = prog(s, ...chRange(i, C.exit, k));
  const x = easeInOutSine(xp);
  const fadeOut = 1 - smooth(prog(s, ...chRange(i, C.exitFade, k)));
  const exitDy = x * vh * 0.06;
  const exitRotY = x * 4 * DEG;
  const chapterP = prog(s, ...chRange(i, [0, EXP.chapter], k));
  const breathe = 1 + Math.sin(chapterP * Math.PI) * 0.015;

  if (i === 0) {
    if (fadeOut <= 0) return HIDDEN;
    return {
      dx: 0,
      dy: exitDy,
      rotZ: 0,
      rotY: exitRotY,
      scale: breathe * (1 - x * 0.02),
      opacity: fadeOut,
      grounded: 1 - Math.min(1, xp * 2.5),
    };
  }

  const e = easeOutCubic(prog(s, ...chRange(i, C.enter, k)));
  const fadeIn = smooth(prog(s, ...chRange(i, C.enterFade, k)));
  if (fadeIn <= 0 || fadeOut <= 0) return HIDDEN;

  // Enter: rises a little from below, barely turning
  const inv = 1 - e;
  return {
    dx: 0,
    dy: -inv * vh * 0.1 + exitDy,
    rotZ: 0,
    rotY: -inv * 5 * DEG + exitRotY,
    scale: (0.96 + 0.04 * e) * breathe * (1 - x * 0.02),
    opacity: fadeIn * fadeOut,
    grounded: e * (1 - Math.min(1, xp * 2.5)),
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
  const n = chapterCount();
  for (let i = 0; i < n; i++) w += smooth(prog(s, ...chRange(i, EXP.ch.world, k)));
  const total = expTotal(k);
  const back = smooth(prog(s, total - EXP.outro * k - 30 * k, total - 10 * k));
  const from = Math.floor(w);
  return { from, to: Math.min(n, from + 1), t: w - from, house: back };
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

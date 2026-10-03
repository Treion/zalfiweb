/**
 * Scroll choreography for the home experience, in viewport-height units ("vh").
 * The single source of truth for BOTH the DOM timeline (GSAP) and the WebGL stage, so type,
 * notes and bottles can never drift apart. Mobile multiplies every length by MOBILE_SCALE.
 */
export const MOBILE_SCALE = 0.62;

export const EXP = {
  /** The landing: the ZALFI emblem and wordmark, which recede as the line-up rises in */
  intro: 90,
  /** The six bottles lined up, then Reva steps forward into its world */
  lineup: 110,
  chapter: 360,
  outro: 80,
  /** Offsets within a chapter, relative to its start (may be negative = overlaps the previous one) */
  ch: {
    // Bottles hand over in sequence with a short crossfade: the outgoing one lifts away and
    // dissolves as the incoming one rises, while the world washes slowly from one to the next.
    enter: [-20, 70],
    world: [-45, 45],
    masthead: [15, 85],
    eyebrow: [5, 55],
    tagline: [35, 95],
    top: [75, 130],
    heart: [145, 200],
    base: [215, 270],
    // Discover + Add to bag are there from the start of the chapter, until it leaves
    cta: [25, 75],
    mastheadOut: [295, 340],
    textOut: [300, 345],
    exit: [300, 360],
  },
  /** The landing logo leaving (absolute, from the top of the page) */
  intro_: {
    /** The scroll cue goes first */
    cueOut: [0, 12],
    /** The letters drift a little apart as the logo sinks back */
    drift: [0, 80],
    /** ...and it fades into the dark */
    fade: [14, 54],
    /** The small nav wordmark takes over */
    navLogo: [40, 70],
  },
  /** The line-up, relative to its start (lineupStart): it rises in, then hands over to Reva */
  lineup_: {
    /** Each bottle rises into its slot (the first; each next one starts `stagger` later) */
    arrive: [-60, -20],
    stagger: 4,
    /** The headline and scroll cue arrive */
    textIn: [-52, -14],
    /** Headline, names, prices and the scroll cue fade away */
    textOut: [6, 40],
    /** The other five bottles dissolve (each a little after the last) */
    fade: [10, 58],
    /** Reva glides from its place in the line-up into its world */
    handoff: [14, 100],
    /** The line-up layer leaves (and stops taking clicks) */
    layerOut: [54, 66],
  },
} as const;

/**
 * How long a line-up hover takes to fill the room with its world, and to leave it: the stage's
 * colour follow (smooth time, s) and the DOM ink transition (globals.css, --room-ink) are matched.
 */
export const ROOM_FOLLOW_S = 0.4;

/**
 * How many chapters the home experience has: one per published fragrance (six at launch). Set by
 * the Experience and the stage from the catalogue they render, so hiding or adding a fragrance in
 * the admin reshapes the timeline without code changes.
 */
const chapters = { count: 6 };
export const chapterCount = () => chapters.count;
export function setChapterCount(n: number) {
  chapters.count = Math.max(1, Math.round(n));
}

export function expTotal(k = 1, n = chapters.count) {
  return (EXP.intro + EXP.lineup + n * EXP.chapter + EXP.outro) * k;
}

/** Where the line-up stands complete, every bottle in its slot */
export const lineupStart = (k = 1) => EXP.intro * k;

export function chapterStart(i: number, k = 1) {
  return (EXP.intro + EXP.lineup + i * EXP.chapter) * k;
}

/** 0..1 progress of s through [a, b] (absolute vh units) */
export const prog = (s: number, a: number, b: number) =>
  Math.min(1, Math.max(0, (s - a) / (b - a)));

export const smooth = (t: number) => t * t * (3 - 2 * t);
export const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Absolute range for a chapter-relative segment */
export const chRange = (i: number, seg: readonly [number, number], k = 1): [number, number] => [
  chapterStart(i, k) + seg[0] * k,
  chapterStart(i, k) + seg[1] * k,
];

/** Index of the chapter that "owns" scroll position s (-1 before chapters, the count after) */
export function chapterAt(s: number, k = 1) {
  if (s < chapterStart(0, k) + EXP.ch.world[0] * k) return -1;
  const i = Math.floor((s - chapterStart(0, k)) / (EXP.chapter * k) + 1e-6);
  return Math.min(chapters.count, Math.max(0, i));
}

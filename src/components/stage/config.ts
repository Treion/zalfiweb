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
  /**
   * Each chapter's length (it was 360, then 260). Every step inside a chapter is spaced to it, so
   * the pace stays even and the scrub as soft.
   */
  chapter: 240,
  outro: 80,
  /** Offsets within a chapter, relative to its start (may be negative = overlaps the previous one) */
  ch: {
    // The hand-over between two worlds, all within ~40vh around the chapter's start:
    //  - the outgoing chapter's words and name leave first (textOut, mastheadOut, of the last one)
    //  - its bottle lifts a little and dissolves (exit), gone just before the next one shows
    //  - the room washes from one world to the next (world), both in the same deep tone
    //  - the incoming bottle rises gently into the light (enter), then its name and words
    // The bottles never overlap, so there is no ghost of one over the other.
    enter: [-12, 40],
    world: [-30, 14],
    masthead: [10, 50],
    // The chapter's layer fades in from here
    open: [2, 30],
    tagline: [20, 56],
    top: [44, 80],
    heart: [88, 122],
    base: [132, 166],
    // Discover + Add to bag are there from the start of the chapter, until it leaves
    cta: [16, 46],
    mastheadOut: [194, 222],
    textOut: [196, 224],
    exit: [200, 240],
    // The bottles' own fades within exit and enter: the outgoing one is gone (230 = 10 before the
    // next chapter starts) just before the incoming one begins to show (-8)
    exitFade: [208, 230],
    enterFade: [-8, 18],
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

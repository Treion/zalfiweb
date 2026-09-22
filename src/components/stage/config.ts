/**
 * Scroll choreography for the home experience, in viewport-height units ("vh").
 * The single source of truth for BOTH the DOM timeline (GSAP) and the WebGL stage, so type,
 * notes and bottles can never drift apart. Mobile multiplies every length by MOBILE_SCALE.
 */
export const MOBILE_SCALE = 0.62;

export const EXP = {
  intro: 100,
  hero: 170,
  chapter: 360,
  outro: 80,
  /** Offsets within a chapter, relative to its start (may be negative = overlaps the previous one) */
  ch: {
    enter: [-40, 40],
    world: [-30, 30],
    masthead: [10, 70],
    eyebrow: [0, 50],
    tagline: [30, 90],
    top: [70, 125],
    heart: [140, 195],
    base: [210, 265],
    cta: [270, 305],
    mastheadOut: [300, 340],
    textOut: [305, 345],
    exit: [320, 400],
  },
  hero_: {
    introOut: [0, 80],
    rise: [10, 120],
    headline: [60, 110],
    headlineOut: [135, 165],
  },
} as const;

export const CHAPTER_COUNT = 6;

export function expTotal(k = 1) {
  return (EXP.intro + EXP.hero + CHAPTER_COUNT * EXP.chapter + EXP.outro) * k;
}

export function chapterStart(i: number, k = 1) {
  return (EXP.intro + EXP.hero + i * EXP.chapter) * k;
}

export const heroStart = (k = 1) => EXP.intro * k;

/** 0..1 progress of s through [a, b] (absolute vh units) */
export const prog = (s: number, a: number, b: number) =>
  Math.min(1, Math.max(0, (s - a) / (b - a)));

export const smooth = (t: number) => t * t * (3 - 2 * t);
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Absolute range for a chapter-relative segment */
export const chRange = (i: number, seg: readonly [number, number], k = 1): [number, number] => [
  chapterStart(i, k) + seg[0] * k,
  chapterStart(i, k) + seg[1] * k,
];

/** Index of the chapter that "owns" scroll position s (-1 before chapters, CHAPTER_COUNT after) */
export function chapterAt(s: number, k = 1) {
  if (s < chapterStart(0, k) + EXP.ch.world[0] * k) return -1;
  const i = Math.floor((s - chapterStart(0, k)) / (EXP.chapter * k) + 1e-6);
  return Math.min(CHAPTER_COUNT, Math.max(0, i));
}

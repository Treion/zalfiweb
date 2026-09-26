"use client";

import { useRef, useState, type CSSProperties } from "react";
import { gsap, useGSAP, EASE, ScrollTrigger } from "@/components/motion/gsap";
import { useLenis } from "@/components/motion/SmoothScroll";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";
import { SplitWords } from "@/components/motion/SplitWords";
import { LOGO_PARTS } from "@/components/brand/logo-paths";
import { BottleImage, bottleAspect } from "@/components/media/BottleImage";
import {
  CHAPTER_COUNT,
  EXP,
  INTRO_POSE,
  MOBILE_SCALE,
  chapterAt,
  chapterStart,
  expTotal,
  heroStart,
} from "@/components/stage/config";
import { StageAnchor } from "@/components/stage/StageAnchor";
import { stageState } from "@/components/stage/stage-state";
import { canRunStage } from "@/components/stage/support";
import type { Fragrance } from "@/lib/fragrance";
import { ChapterIndex, WorldVeil } from "./ChapterIndex";
import { FragranceChapter, buildChapterTimeline } from "./FragranceChapter";

/** One `sizes` for both hero photos (stage fallback and static lockup), so they share a file */
const HERO_SIZES = "(min-width: 768px) 30svh, 32svh";

/** Where a jump lands in a chapter: name, tagline and top notes are set (vh units) */
const JUMP_TO = 130;

type Props = { fragrances: Fragrance[]; noteAvail: Record<string, boolean> };

/**
 * The home experience: brand intro → hero bottle → six fragrance chapters, all inside one sticky
 * viewport over the WebGL stage. One master GSAP timeline (1 unit = 1vh of scroll) is scrubbed by
 * ScrollTrigger; it drives the DOM and writes stageState.s for the stage, so type and light move
 * as one.
 */
export function Experience({ fragrances, noteAvail }: Props) {
  const root = useRef<HTMLElement>(null);
  const master = useRef<gsap.core.Timeline | null>(null);
  const reduced = useReducedMotion();
  const lenis = useLenis();
  const [active, setActive] = useState(-1);
  const [veil, setVeil] = useState<number | null>(null);
  const hero = fragrances[0];

  /**
   * Jump to a chapter without rushing through the worlds in between: wash the screen in the
   * destination world, move the scroll (and the scrubbed timeline) behind it, then lift the wash.
   */
  function jumpTo(i: number) {
    const st = master.current?.scrollTrigger;
    if (!st || veil !== null) return;
    setVeil(i);
    gsap.delayedCall(0.5, () => {
      const k = stageState.k;
      const y = st.start + ((st.end - st.start) * (chapterStart(i, k) + JUMP_TO * k)) / expTotal(k);
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
      ScrollTrigger.update();
      st.getTween()?.progress(1);
      // let the stage settle into the new world before the wash lifts
      gsap.delayedCall(0.35, () => setVeil(null));
    });
  }

  useGSAP(
    () => {
      if (reduced || !canRunStage() || !root.current) return;
      const q = gsap.utils.selector(root);

      // 1. Intro, on load (time-based, once, then still): the emblem assembles where the bottle
      // will stand, the ZALFI letters rise beneath it, and the emblem, itself a bottle silhouette,
      // grows and dissolves into the real bottle.
      const emblem = q("[data-intro-emblem]")[0] as HTMLElement;
      const reveal = q("[data-hero-reveal]")[0] as HTMLElement;
      const anchor = q('[data-stage-anchor="experience"]')[0] as HTMLElement;
      // CSS already centres the emblem on the bottle's landing pose, so the morph only scales it
      // up to the bottle's landing height (the anchor is never transformed, so this is exact)
      const growTo = () =>
        (anchor.getBoundingClientRect().height * INTRO_POSE.scale * 0.9) /
        emblem.getBoundingClientRect().height;
      const intro = gsap.timeline({ delay: 0.2, defaults: { ease: EASE.cinema } });
      intro
        .set(emblem, { opacity: 1 })
        .fromTo(
          q('[data-intro-emblem] [data-logo-part="cap"]'),
          { y: -60, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.4 },
        )
        .fromTo(
          q('[data-intro-emblem] [data-logo-part="body"]'),
          { scale: 0.92, opacity: 0, transformOrigin: "50% 50%" },
          { scale: 1, opacity: 1, duration: 1.4 },
          "<0.12",
        )
        // The rise moves each letter's path; the scroll drift below moves its group. Kept on
        // separate elements because GSAP folds SVG percentages into px when a second tween re-reads
        // the transform matrix (on ScrollTrigger refresh), which left the letters stuck below.
        .fromTo(
          q("[data-letter-rise]"),
          { yPercent: 115, opacity: 1 },
          { yPercent: 0, duration: 1.5, stagger: 0.085 },
          0.9,
        )
        .addLabel("morph", 1.9)
        .to(emblem, { scale: growTo, duration: 2.2, ease: EASE.silk }, "morph")
        .to(emblem, { opacity: 0, duration: 1.3, ease: "power1.inOut" }, "morph+=0.35")
        .fromTo(
          reveal,
          { opacity: 0, scale: 0.94 },
          { opacity: 1, scale: 1, duration: 1.9, ease: EASE.silk },
          "morph+=0.5",
        )
        .fromTo(
          stageState,
          { intro: 0 },
          { intro: 1, duration: 1.9, ease: EASE.silk },
          "morph+=0.5",
        )
        .fromTo(
          q("[data-intro-meta]"),
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 1.4, stagger: 0.12 },
          "morph+=1.3",
        );
      // Arriving further down the page (a reload, a link to #collection): no morph off-screen
      const skip = requestAnimationFrame(() => {
        if (window.scrollY > window.innerHeight * 0.5) intro.progress(1);
      });

      // 2. Scroll: one master timeline per breakpoint
      const mm = gsap.matchMedia();
      mm.add({ desktop: "(min-width: 768px)", mobile: "(max-width: 767.98px)" }, (ctx) => {
        const k = ctx.conditions?.desktop ? 1 : MOBILE_SCALE;
        stageState.k = k;
        const total = expTotal(k);
        let last = -2;

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: "bottom bottom",
            // Lenis already smooths the wheel; a one-second scrub lets type and light settle as one
            scrub: 1,
            invalidateOnRefresh: true,
          },
          onUpdate: () => {
            const c = chapterAt(stageState.s, k);
            if (c !== last) {
              last = c;
              setActive(c);
            }
          },
        });
        tl.fromTo(stageState, { s: 0 }, { s: total, duration: total }, 0);
        master.current = tl;

        // The chapter index shows for the length of the chapters
        const index = q("[data-chapter-index]");
        tl.fromTo(
          index,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 30 * k },
          chapterStart(0, k) + EXP.ch.world[0] * k,
        );
        tl.to(index, { autoAlpha: 0, duration: 20 * k }, chapterStart(CHAPTER_COUNT, k) - 30 * k);

        // Intro recedes: letters drift apart, the logo sinks back into the dark
        const iS = 0;
        tl.to(q("[data-intro-cue]"), { opacity: 0, duration: 20 * k }, iS);
        tl.to(
          q("[data-logo-letter]"),
          { x: (i: number) => (i - 2) * 46, duration: 80 * k, ease: EASE.silk },
          iS,
        );
        tl.to(
          q("[data-intro]"),
          { scale: 0.74, yPercent: -10, duration: 90 * k, ease: EASE.silk },
          iS,
        );
        tl.to(q("[data-intro]"), { opacity: 0, duration: 45 * k }, iS + 35 * k);
        const navLogo = document.querySelector("[data-nav-logo]");
        if (navLogo)
          tl.fromTo(navLogo, { opacity: 0 }, { opacity: 1, duration: 30 * k }, iS + 50 * k);

        // Hero: the bottle, already standing on the landing screen, settles into the hero (the
        // stage draws it; the DOM image is the fallback until then), and the headline sets
        const h = heroStart(k);
        const H = EXP.hero_;
        // (mirrors bottlePose in stage/choreography.ts, so the fallback and the render agree)
        tl.fromTo(
          q("[data-hero-fallback]"),
          { y: () => -window.innerHeight * INTRO_POSE.lift, scale: INTRO_POSE.scale },
          { y: 0, scale: 1, duration: (H.settle[1] - H.settle[0]) * k, ease: EASE.glide },
          h + H.settle[0] * k,
        );
        tl.to(
          q("[data-hero-fallback]"),
          {
            y: () => -window.innerHeight * 0.35,
            x: () => -window.innerWidth * 0.03,
            opacity: 0,
            duration: (EXP.ch.exit[1] - EXP.ch.exit[0]) * k,
            ease: EASE.glide,
          },
          chapterStart(0, k) + EXP.ch.exit[0] * k,
        );
        tl.fromTo(
          q("[data-hero-copy]"),
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 5 * k },
          h + H.headline[0] * k - 5 * k,
        );
        tl.fromTo(
          q("[data-hero-copy] [data-w]"),
          { yPercent: 110, opacity: 1 },
          { yPercent: 0, duration: 40 * k, stagger: 3 * k, ease: EASE.soft },
          h + H.headline[0] * k,
        );
        tl.fromTo(
          q("[data-hero-copy] [data-hero-meta]"),
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 30 * k, stagger: 6 * k },
          h + H.headline[0] * k + 20 * k,
        );
        tl.to(
          q("[data-hero-copy]"),
          { autoAlpha: 0, y: -30, duration: (H.headlineOut[1] - H.headlineOut[0]) * k },
          h + H.headlineOut[0] * k,
        );

        // Chapters
        q("[data-chapter]").forEach((el, i) => buildChapterTimeline(tl, el as HTMLElement, i, k));
        return () => {
          master.current = null;
        };
      });
      return () => {
        cancelAnimationFrame(skip);
        mm.revert();
      };
    },
    { scope: root, dependencies: [reduced] },
  );

  const style = {
    "--exp-h": `${expTotal(1)}svh`,
    "--exp-h-m": `${expTotal(MOBILE_SCALE)}svh`,
  } as CSSProperties;

  return (
    <section
      ref={root}
      aria-label="ZALFI: six fragrances"
      className="static:h-auto relative h-(--exp-h-m) md:h-(--exp-h)"
      style={style}
    >
      <div className="world-surface static:relative static:h-auto static:overflow-visible sticky top-0 h-svh overflow-hidden [--world-bg:var(--noir)]">
        {/* The bottle's place on the stage */}
        <StageAnchor
          kind="experience"
          className="static:hidden pointer-events-none absolute top-[43%] left-1/2 h-[34svh] -translate-x-1/2 -translate-y-1/2 md:top-[48%] md:h-[62svh]"
          style={{ aspectRatio: bottleAspect(hero.slug) }}
        >
          {/* Three wrappers, so no two tweens share a property: scroll moves the outer one (landing
              pose → hero → exit), the load morph fades in the middle one, and the inner one is the
              stage fallback, faded by CSS once the stage has drawn this bottle */}
          <div data-hero-fallback className="absolute inset-0">
            <div data-hero-reveal data-reveal className="absolute inset-0">
              <div data-stage-fallback={hero.slug} className="absolute inset-0">
                <BottleImage fragrance={hero} fit="trim" preload sizes={HERO_SIZES} />
              </div>
            </div>
          </div>
        </StageAnchor>

        <Intro hero={hero} />
        <HeroCopy />

        {fragrances.map((f, i) => (
          <FragranceChapter
            key={f.slug}
            fragrance={f}
            index={i}
            count={fragrances.length}
            noteAvail={noteAvail}
            mounted={active === -1 ? i === 0 : Math.abs(active - i) <= 1}
          />
        ))}
      </div>

      <ChapterIndex fragrances={fragrances} active={active} onJump={jumpTo} />
      <WorldVeil fragrance={veil === null ? null : fragrances[veil]} />
    </section>
  );
}

const bounds = (parts: typeof LOGO_PARTS) =>
  parts.reduce(
    (b, p) => [
      Math.min(b[0], p.box[0]),
      Math.min(b[1], p.box[1]),
      Math.max(b[2], p.box[2]),
      Math.max(b[3], p.box[3]),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  );

/** The emblem (cap + body): the logo's own bottle silhouette */
function Emblem({ className }: { className?: string }) {
  const parts = LOGO_PARTS.filter((p) => ["cap", "body"].includes(p.id));
  const b = bounds(parts);
  return (
    <svg
      viewBox={`${b[0]} ${b[1]} ${b[2] - b[0]} ${b[3] - b[1]}`}
      fill="currentColor"
      aria-hidden
      className={className}
    >
      {parts.map((p) => (
        <path key={p.id} d={p.d} data-logo-part={p.id} />
      ))}
    </svg>
  );
}

const EMBLEM_ASPECT = (() => {
  const b = bounds(LOGO_PARTS.filter((p) => ["cap", "body"].includes(p.id)));
  return (b[2] - b[0]) / (b[3] - b[1]);
})();

/**
 * The landing screen. The hero bottle stands at its landing pose (see INTRO_POSE) with the ZALFI
 * wordmark beneath it. On load the emblem assembles exactly where the bottle stands, then grows
 * and dissolves into it. The static layout gets the same arrival in CSS, around a DOM photo.
 */
function Intro({ hero }: { hero: Fragrance }) {
  const letters = LOGO_PARTS.filter((p) => !["cap", "body"].includes(p.id));
  const wm = bounds(letters);
  const clip = [wm[0] - 40, wm[1] - 30, wm[2] - wm[0] + 80, wm[3] - wm[1] + 34];
  return (
    <div className="px-gutter text-bone static:relative static:flex static:min-h-svh static:flex-col static:items-center static:justify-center static:py-28 absolute inset-0">
      <h1 className="sr-only">ZALFI, maison de parfum</h1>

      {/* Stage layout: the emblem, at the bottle's landing centre */}
      <div
        data-intro-emblem
        data-reveal
        className="static:hidden pointer-events-none absolute top-[calc(43%-12svh)] left-1/2 h-[8svh] -translate-1/2 md:top-[calc(48%-12svh)] md:h-[11svh]"
        style={{ aspectRatio: EMBLEM_ASPECT }}
      >
        <Emblem className="block h-full w-full overflow-visible" />
      </div>

      {/* Static layout: the same arrival, in CSS (globals.css, .intro-static-*) */}
      <div
        className="static:block relative hidden h-[34svh] md:h-[42svh]"
        style={{ aspectRatio: bottleAspect(hero.slug) }}
      >
        <div className="intro-static-bottle absolute inset-0">
          <BottleImage fragrance={hero} fit="trim" sizes={HERO_SIZES} />
        </div>
        <div
          className="intro-static-emblem absolute top-1/2 left-1/2 h-[24%] -translate-1/2"
          style={{ aspectRatio: EMBLEM_ASPECT }}
        >
          <Emblem className="block h-full w-full" />
        </div>
      </div>

      <div
        data-intro
        className="static:relative static:inset-auto static:mt-12 static:translate-x-0 absolute top-[52%] left-1/2 w-[min(56vw,20rem)] -translate-x-1/2 md:top-[64%] md:w-[min(32vw,28rem)]"
      >
        <svg
          viewBox={clip.join(" ")}
          fill="currentColor"
          aria-hidden
          className="block w-full overflow-visible"
        >
          <defs>
            <clipPath id="zalfi-wm-clip">
              <rect x={clip[0]} y={clip[1]} width={clip[2]} height={clip[3]} />
            </clipPath>
          </defs>
          <g clipPath="url(#zalfi-wm-clip)">
            {letters.map((p) => (
              <g key={p.id} data-logo-letter>
                <path d={p.d} data-logo-part={p.id} data-letter-rise data-reveal />
              </g>
            ))}
          </g>
        </svg>
        <p data-intro-meta data-reveal className="eyebrow text-bone-dim mt-8 text-center md:mt-10">
          Maison de parfum
        </p>
      </div>
      <div
        data-intro-cue
        className="static:hidden absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3"
      >
        <span data-intro-meta data-reveal className="eyebrow text-bone-dim text-[0.6rem]">
          Scroll
        </span>
        <span className="bg-bone/15 block h-10 w-px overflow-hidden">
          <span className="bg-bone block h-full w-full motion-safe:animate-[scroll-cue_3.6s_var(--ease-silk)_infinite]" />
        </span>
      </div>
    </div>
  );
}

function HeroCopy() {
  return (
    <div
      data-hero-copy
      data-reveal="layer"
      className="px-gutter text-bone static:relative static:inset-auto static:py-24 pointer-events-none absolute inset-x-0 top-[13svh] md:top-auto md:bottom-[9svh]"
    >
      <div className="grid grid-cols-12 items-end gap-4">
        <h2 className="font-display col-span-12 text-[clamp(2.6rem,6.2vw,7rem)] leading-[0.95] md:col-span-6">
          <SplitWords text="Six worlds," />
          <br />
          <SplitWords text="in smoked glass." className="display-italic" />
        </h2>
        <div className="col-span-12 hidden md:col-span-3 md:col-start-10 md:block">
          <p data-hero-meta data-reveal className="text-bone-dim text-sm leading-relaxed">
            Six eaux de parfum, each composed as a place. Scroll, and step inside each one.
          </p>
          <p data-hero-meta data-reveal className="eyebrow text-bone mt-6">
            Eau de parfum · 50 ml &amp; 100 ml
          </p>
        </div>
      </div>
    </div>
  );
}

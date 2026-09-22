"use client";

import { useRef, useState, type CSSProperties } from "react";
import { gsap, useGSAP, EASE } from "@/components/motion/gsap";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";
import { SplitWords } from "@/components/motion/SplitWords";
import { LOGO_PARTS, LOGO_VIEWBOX } from "@/components/brand/logo-paths";
import { BottleImage, bottleAspect } from "@/components/media/BottleImage";
import {
  EXP,
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
import { FragranceChapter, buildChapterTimeline } from "./FragranceChapter";

type Props = { fragrances: Fragrance[]; noteAvail: Record<string, boolean> };

/**
 * The home experience: brand intro → hero bottle → six fragrance chapters, all inside one sticky
 * viewport over the WebGL stage. One master GSAP timeline (1 unit = 1vh of scroll) is scrubbed by
 * ScrollTrigger; it drives the DOM and writes stageState.s for the stage, so type and light move
 * as one.
 */
export function Experience({ fragrances, noteAvail }: Props) {
  const root = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const [active, setActive] = useState(-1);
  const hero = fragrances[0];

  useGSAP(
    () => {
      if (reduced || !canRunStage() || !root.current) return;
      const q = gsap.utils.selector(root);

      // 1. Intro: the logo assembles on load (time-based, once)
      const intro = gsap.timeline({ delay: 0.25, defaults: { ease: EASE.cinema } });
      intro
        .fromTo(
          q('[data-logo-part="cap"]'),
          { y: -90, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.6 },
        )
        .fromTo(
          q('[data-logo-part="body"]'),
          { scale: 0.9, opacity: 0, transformOrigin: "50% 50%" },
          { scale: 1, opacity: 1, duration: 1.6 },
          "<0.12",
        )
        .fromTo(
          q("[data-logo-letter]"),
          { yPercent: 115, opacity: 1 },
          { yPercent: 0, duration: 1.5, stagger: 0.085 },
          "<0.3",
        )
        .fromTo(
          q("#zalfi-glint"),
          { attr: { x1: -700, x2: -200 } },
          { attr: { x1: 1700, x2: 2200 }, duration: 1.8, ease: EASE.silk },
          "-=0.5",
        )
        .fromTo(
          q("[data-intro-meta]"),
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 1.2, stagger: 0.12 },
          "-=1.4",
        );

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
            scrub: 0.9,
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

        // Hero: the first bottle rises into the light (the stage draws it; the DOM image is the
        // fallback until then), and the headline sets
        const h = heroStart(k);
        const H = EXP.hero_;
        tl.fromTo(
          q("[data-hero-fallback]"),
          { y: () => window.innerHeight * 0.95, opacity: 0 },
          { y: 0, opacity: 1, duration: (H.rise[1] - H.rise[0]) * k, ease: "power3.out" },
          h + H.rise[0] * k,
        );
        tl.to(
          q("[data-hero-fallback]"),
          {
            y: () => -window.innerHeight * 0.72,
            x: () => -window.innerWidth * 0.3,
            opacity: 0,
            duration: 80 * k,
            ease: "power2.inOut",
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
          { yPercent: 0, duration: 40 * k, stagger: 3 * k, ease: EASE.cinema },
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

        // Pointer parallax for floating notes (desktop only), via quickTo: no per-frame React
        if (ctx.conditions?.desktop) {
          const layers = q("[data-pointer-depth]").map((el) => ({
            depth: Number((el as HTMLElement).dataset.pointerDepth),
            x: gsap.quickTo(el, "x", { duration: 1.1, ease: "power3.out" }),
            y: gsap.quickTo(el, "y", { duration: 1.1, ease: "power3.out" }),
          }));
          const move = (e: PointerEvent) => {
            const nx = e.clientX / window.innerWidth - 0.5;
            const ny = e.clientY / window.innerHeight - 0.5;
            for (const l of layers) {
              l.x(-nx * 36 * l.depth);
              l.y(-ny * 26 * l.depth);
            }
          };
          window.addEventListener("pointermove", move, { passive: true });
          return () => window.removeEventListener("pointermove", move);
        }
      });
      return () => mm.revert();
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
          <div
            data-hero-fallback
            data-reveal
            data-stage-fallback={hero.slug}
            className="absolute inset-0"
          >
            <BottleImage fragrance={hero} fit="trim" sizes="(min-width: 768px) 30svh, 32svh" />
          </div>
        </StageAnchor>

        <Intro />
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
    </section>
  );
}

function Intro() {
  const letters = LOGO_PARTS.filter((p) => !["cap", "body"].includes(p.id));
  const emblem = LOGO_PARTS.filter((p) => ["cap", "body"].includes(p.id));
  const wm = letters.reduce(
    (b, p) => [
      Math.min(b[0], p.box[0]),
      Math.min(b[1], p.box[1]),
      Math.max(b[2], p.box[2]),
      Math.max(b[3], p.box[3]),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
  return (
    <div className="px-gutter text-bone static:relative static:min-h-svh absolute inset-0 flex flex-col items-center justify-center">
      <div data-intro className="w-[min(64vw,34rem)] md:w-[min(40vw,36rem)]">
        <h1 className="sr-only">ZALFI, maison de parfum</h1>
        <svg
          viewBox={LOGO_VIEWBOX}
          fill="currentColor"
          aria-hidden
          className="block w-full overflow-visible"
        >
          <defs>
            <clipPath id="zalfi-wm-clip">
              <rect
                x={wm[0] - 40}
                y={wm[1] - 30}
                width={wm[2] - wm[0] + 80}
                height={wm[3] - wm[1] + 34}
              />
            </clipPath>
            <linearGradient
              id="zalfi-glint"
              gradientUnits="userSpaceOnUse"
              x1="-700"
              y1="0"
              x2="-200"
              y2="220"
            >
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0.95" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          {emblem.map((p) => (
            <path key={p.id} d={p.d} data-logo-part={p.id} data-reveal />
          ))}
          <g clipPath="url(#zalfi-wm-clip)">
            {letters.map((p) => (
              <g key={p.id} data-logo-letter data-reveal>
                <path d={p.d} data-logo-part={p.id} />
                <path d={p.d} fill="url(#zalfi-glint)" style={{ mixBlendMode: "overlay" }} />
              </g>
            ))}
          </g>
        </svg>
        <p data-intro-meta data-reveal className="eyebrow text-bone-dim mt-10 text-center md:mt-12">
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
        <span className="bg-bone/15 block h-12 w-px overflow-hidden">
          <span className="bg-bone block h-full w-full motion-safe:animate-[scroll-cue_2.4s_var(--ease-silk)_infinite]" />
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

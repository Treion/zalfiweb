"use client";

import { useRef, useState, type CSSProperties } from "react";
import { gsap, useGSAP, EASE, ScrollTrigger } from "@/components/motion/gsap";
import { useLenis } from "@/components/motion/SmoothScroll";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";
import { bottleAspect } from "@/components/media/BottleImage";
import {
  EXP,
  MOBILE_SCALE,
  chapterAt,
  chapterStart,
  expTotal,
  lineupStart,
  setChapterCount,
} from "@/components/stage/config";
import { lineupOpen } from "@/components/stage/choreography";
import { StageAnchor } from "@/components/stage/StageAnchor";
import { stageState } from "@/components/stage/stage-state";
import { canRunStage } from "@/components/stage/support";
import type { Fragrance } from "@/lib/fragrance";
import { ChapterIndex, WorldVeil } from "./ChapterIndex";
import { FragranceChapter, buildChapterTimeline } from "./FragranceChapter";
import { Landing } from "./Landing";
import { Lineup } from "./Lineup";
import { closeRoom, roomOpen } from "./room";
import { countWord } from "@/lib/words";

/** Where a jump lands in a chapter: name, tagline and top notes are set (vh units) */
const JUMP_TO = 130;

type Props = { fragrances: Fragrance[]; noteAvail: Record<string, boolean> };

/** Scroll offset (svh) at which the line-up stands complete: where links to #collection land */
const lineupAt = (k: number, n: number) =>
  (lineupStart(k) / expTotal(k, n)) * (expTotal(k, n) - 100);

/**
 * The home experience, in one sticky viewport over the WebGL stage: it lands on the ZALFI logo;
 * scrolling lets it sink back as the six bottles rise into a line-up, then hands Reva forward into
 * its world while the others dissolve, and the six chapters follow. One master GSAP timeline (1 unit = 1vh of scroll) is scrubbed by
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
  const first = fragrances[0];
  // One chapter per published fragrance: the shared timing helpers read this count
  const count = fragrances.length;
  setChapterCount(count);

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

      // 1. Landing, on load (time-based, once, then still): the emblem assembles and the ZALFI
      // letters rise into place
      const intro = gsap.timeline({ delay: 0.25, defaults: { ease: EASE.cinema } });
      intro
        .fromTo(
          q('[data-landing] [data-logo-part="cap"]'),
          { y: -70, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.6 },
        )
        .fromTo(
          q('[data-landing] [data-logo-part="body"]'),
          { scale: 0.92, opacity: 0, transformOrigin: "50% 50%" },
          { scale: 1, opacity: 1, duration: 1.6 },
          "<0.12",
        )
        .fromTo(
          q("[data-letter-rise]"),
          { yPercent: 115, opacity: 1 },
          { yPercent: 0, duration: 1.5, stagger: 0.085 },
          "<0.3",
        )
        .fromTo(
          q("[data-intro-meta]"),
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 1.4, stagger: 0.12 },
          "-=0.6",
        );
      // Arriving further down the page (a reload, a link to #collection): no assembly off-screen
      const skip = requestAnimationFrame(() => {
        if (window.scrollY > window.innerHeight * 0.3) intro.progress(1);
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
            // Scrolling away from the line-up takes its hover world with it
            if (roomOpen() && lineupOpen(stageState.s, k) < 0.5) closeRoom();
          },
        });
        tl.fromTo(stageState, { s: 0 }, { s: total, duration: total }, 0);
        master.current = tl;
        const span = (seg: readonly [number, number]) => (seg[1] - seg[0]) * k;

        // The landing logo sinks back: its letters drift a little apart as it fades into the dark,
        // and the small wordmark in the nav takes over
        const I = EXP.intro_;
        tl.to(q("[data-intro-cue]"), { opacity: 0, duration: span(I.cueOut) }, I.cueOut[0] * k);
        tl.to(
          q("[data-logo-letter]"),
          { x: (i: number) => (i - 2) * 30, duration: span(I.drift), ease: EASE.glide },
          I.drift[0] * k,
        );
        tl.to(
          q("[data-intro]"),
          { scale: 0.9, yPercent: -8, duration: span(I.drift), ease: EASE.glide },
          I.drift[0] * k,
        );
        tl.to(
          q("[data-intro]"),
          { opacity: 0, duration: span(I.fade), ease: EASE.glide },
          I.fade[0] * k,
        );
        const navLogo = document.querySelector("[data-nav-logo]");
        if (navLogo)
          tl.fromTo(
            navLogo,
            { opacity: 0 },
            { opacity: 1, duration: span(I.navLogo) },
            I.navLogo[0] * k,
          );

        // The line-up rises in beneath it, one bottle after another (the stage follows each slot
        // and fades its render in step: lineupState().arrive)
        const o = lineupStart(k);
        const L = EXP.lineup_;
        const lineup = q("[data-lineup]")[0] as HTMLElement;
        gsap.set(lineup, { pointerEvents: "none" });
        tl.set(lineup, { pointerEvents: "auto" }, o + L.arrive[0] * k + 20 * k);
        tl.fromTo(
          q("[data-lineup-text]"),
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: span(L.textIn), ease: EASE.soft },
          o + L.textIn[0] * k,
        );
        q("[data-lineup-item]").forEach((el, i) =>
          tl.fromTo(
            el,
            { opacity: 0, y: () => window.innerHeight * 0.06 },
            { opacity: 1, y: 0, duration: span(L.arrive), ease: EASE.soft },
            o + (L.arrive[0] + i * L.stagger) * k,
          ),
        );

        // ...then hands over to the first world: its words leave first, then the other five
        // bottles dissolve (the stage fades their render in step) while Reva steps forward
        tl.to(
          q("[data-lineup-text]"),
          { opacity: 0, y: -12, duration: span(L.textOut), ease: EASE.glide },
          o + L.textOut[0] * k,
        );
        tl.to(
          q("[data-lineup-item]"),
          { opacity: 0, y: 12, duration: span(L.fade) * 0.7, stagger: 3 * k, ease: EASE.glide },
          o + L.fade[0] * k,
        );
        tl.to(lineup, { autoAlpha: 0, duration: span(L.layerOut) }, o + L.layerOut[0] * k);

        // The chapter index shows for the length of the chapters
        const index = q("[data-chapter-index]");
        tl.fromTo(
          index,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 30 * k },
          chapterStart(0, k) + EXP.ch.world[0] * k,
        );
        tl.to(
          index,
          { autoAlpha: 0, duration: 20 * k },
          chapterStart(fragrances.length, k) - 30 * k,
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
    "--exp-h": `${expTotal(1, count)}svh`,
    "--exp-h-m": `${expTotal(MOBILE_SCALE, count)}svh`,
    "--lineup-at": `${lineupAt(1, count)}svh`,
    "--lineup-at-m": `${lineupAt(MOBILE_SCALE, count)}svh`,
  } as CSSProperties;

  return (
    <section
      ref={root}
      aria-label={`ZALFI: the collection and its ${countWord(count)} worlds`}
      className="static:h-auto relative h-(--exp-h-m) md:h-(--exp-h)"
      style={style}
    >
      {/* Links to the collection land on the complete line-up, past the landing logo */}
      <div
        id="collection"
        aria-hidden
        className="static:top-[100svh] pointer-events-none absolute top-(--lineup-at-m) left-0 h-px w-px md:top-(--lineup-at)"
      />
      <div className="world-surface static:relative static:h-auto static:overflow-visible sticky top-0 h-svh overflow-hidden [--world-bg:var(--noir)]">
        {/* Where each chapter's bottle stands on the stage */}
        <StageAnchor
          kind="experience"
          className="static:hidden pointer-events-none absolute top-[43%] left-1/2 h-[34svh] -translate-x-1/2 -translate-y-1/2 md:top-[48%] md:h-[62svh]"
          style={{ aspectRatio: bottleAspect(first) }}
        />

        <Landing />
        <Lineup fragrances={fragrances} />

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

"use client";

import { useRef, useState, type CSSProperties } from "react";
import { gsap, useGSAP, EASE, ScrollTrigger } from "@/components/motion/gsap";
import { useLenis } from "@/components/motion/SmoothScroll";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";
import { bottleAspect } from "@/components/media/BottleImage";
import {
  CHAPTER_COUNT,
  EXP,
  MOBILE_SCALE,
  chapterAt,
  chapterStart,
  expTotal,
} from "@/components/stage/config";
import { StageAnchor } from "@/components/stage/StageAnchor";
import { stageState } from "@/components/stage/stage-state";
import { canRunStage } from "@/components/stage/support";
import type { Fragrance } from "@/lib/fragrance";
import { ChapterIndex, WorldVeil } from "./ChapterIndex";
import { FragranceChapter, buildChapterTimeline } from "./FragranceChapter";
import { Lineup } from "./Lineup";

/** Where a jump lands in a chapter: name, tagline and top notes are set (vh units) */
const JUMP_TO = 130;

type Props = { fragrances: Fragrance[]; noteAvail: Record<string, boolean> };

/**
 * The home experience, in one sticky viewport over the WebGL stage: it opens on the six bottles
 * lined up; scrolling hands Reva forward into its world while the others dissolve, then the six
 * chapters follow. One master GSAP timeline (1 unit = 1vh of scroll) is scrubbed by
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

      // One master timeline per breakpoint
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

        // The line-up hands over to the first world: its words leave first, then the other five
        // bottles dissolve (the stage fades their render in step) while Reva steps forward
        const L = EXP.lineup_;
        const span = (seg: readonly [number, number]) => (seg[1] - seg[0]) * k;
        tl.to(
          q("[data-lineup-text]"),
          { opacity: 0, y: -12, duration: span(L.textOut), ease: EASE.glide },
          L.textOut[0] * k,
        );
        tl.to(
          q("[data-lineup-item]"),
          { opacity: 0, y: 12, duration: span(L.fade) * 0.7, stagger: 3 * k, ease: EASE.glide },
          L.fade[0] * k,
        );
        tl.to(q("[data-lineup]"), { autoAlpha: 0, duration: span(L.layerOut) }, L.layerOut[0] * k);

        // The chapter index shows for the length of the chapters
        const index = q("[data-chapter-index]");
        tl.fromTo(
          index,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 30 * k },
          chapterStart(0, k) + EXP.ch.world[0] * k,
        );
        tl.to(index, { autoAlpha: 0, duration: 20 * k }, chapterStart(CHAPTER_COUNT, k) - 30 * k);

        // Chapters
        q("[data-chapter]").forEach((el, i) => buildChapterTimeline(tl, el as HTMLElement, i, k));
        return () => {
          master.current = null;
        };
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
      id="collection"
      aria-label="ZALFI: the collection and its six worlds"
      className="static:h-auto relative h-(--exp-h-m) md:h-(--exp-h)"
      style={style}
    >
      <div className="world-surface static:relative static:h-auto static:overflow-visible sticky top-0 h-svh overflow-hidden [--world-bg:var(--noir)]">
        {/* Where each chapter's bottle stands on the stage */}
        <StageAnchor
          kind="experience"
          className="static:hidden pointer-events-none absolute top-[43%] left-1/2 h-[34svh] -translate-x-1/2 -translate-y-1/2 md:top-[48%] md:h-[62svh]"
          style={{ aspectRatio: bottleAspect(first.slug) }}
        />

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

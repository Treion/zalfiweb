"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/components/motion/gsap";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";
import { SplitWords } from "@/components/motion/SplitWords";
import { Logo } from "@/components/brand/Logo";
import { BottleImage } from "@/components/media/BottleImage";
import type { Fragrance } from "@/lib/fragrance";

/**
 * The house, told briefly. Bone paper after the dark collection: an editorial spread with the
 * headline running over the bottle, the emblem as a watermark, and scrubbed parallax.
 */
export function Story({ feature }: { feature: Fragrance }) {
  const root = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      if (reduced) return;
      const q = gsap.utils.selector(root);
      const st = { trigger: root.current, start: "top bottom", end: "bottom top", scrub: 1 };
      gsap.fromTo(
        q("[data-story-bottle]"),
        { yPercent: 14 },
        { yPercent: -14, ease: "none", scrollTrigger: st },
      );
      gsap.fromTo(
        q("[data-story-mark]"),
        { yPercent: -18, rotate: -6 },
        { yPercent: 12, rotate: 4, ease: "none", scrollTrigger: st },
      );
      gsap.fromTo(
        q("[data-story-head] [data-w]"),
        { yPercent: 110, opacity: 1 },
        {
          yPercent: 0,
          stagger: 0.06,
          ease: "expo.out",
          duration: 1.4,
          scrollTrigger: {
            trigger: q("[data-story-head]")[0],
            start: "top 80%",
            end: "top 35%",
            scrub: 1,
          },
        },
      );
      gsap.fromTo(
        q("[data-story-body] > *"),
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.12,
          ease: "power3.out",
          scrollTrigger: {
            trigger: q("[data-story-body]")[0],
            start: "top 85%",
            end: "top 45%",
            scrub: 1,
          },
        },
      );
    },
    { scope: root, dependencies: [reduced] },
  );

  return (
    <section
      ref={root}
      id="story"
      aria-labelledby="story-title"
      className="bg-bone px-gutter text-noir relative scroll-mt-10 overflow-hidden py-32 md:py-48"
    >
      <div
        data-story-mark
        aria-hidden
        className="text-noir/[0.045] pointer-events-none absolute -top-[8vw] -right-[12vw] w-[64vw] md:w-[46vw]"
      >
        <Logo variant="emblem" title={null} className="w-full" />
      </div>

      <div className="relative grid grid-cols-12 gap-x-4 gap-y-16">
        <p className="eyebrow text-smoke col-span-12 md:col-span-2">The House</p>

        <div className="relative col-span-12 md:col-span-10">
          <h2
            id="story-title"
            data-story-head
            className="font-display relative z-10 text-[clamp(3rem,8.4vw,10rem)] leading-[0.9] tracking-[-0.01em]"
          >
            <SplitWords text="We bottle" />
            <br />
            <SplitWords text="places," className="display-italic" />
            <br />
            <SplitWords text="not perfumes." />
          </h2>

          {/* The bottle sits behind the headline's last line: type over image */}
          <div className="pointer-events-none absolute top-[18%] right-[4%] w-[34%] md:top-[4%] md:right-[22%] md:w-[36%]">
            <div data-story-bottle>
              <BottleImage fragrance={feature} sizes="(min-width: 768px) 30vw, 34vw" />
            </div>
          </div>
        </div>

        <div
          data-story-body
          className="col-span-12 grid gap-10 md:col-span-10 md:col-start-3 md:grid-cols-10"
        >
          <p className="text-lg leading-relaxed md:col-span-4">
            A scent can put you somewhere. A frozen field at dawn. A garden sliding into the sea. A
            room of smoke and gold.
          </p>
          <p className="text-smoke leading-relaxed md:col-span-4 md:col-start-6">
            We compose each fragrance as a place. Then we pour it into the same smoked-glass cube.
            Only the cap tells you which door you are opening.
          </p>
          <dl className="border-noir/15 grid grid-cols-3 gap-6 border-t pt-8 md:col-span-9">
            {[
              ["Six", "worlds, one house"],
              ["Eau", "de parfum, made to linger"],
              ["One", "smoked-glass cube"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="font-display text-[clamp(2rem,4vw,3.75rem)] leading-none">{k}</dt>
                <dd className="text-smoke mt-2 text-xs">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

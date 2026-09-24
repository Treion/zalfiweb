"use client";

import Link from "next/link";
import clsx from "clsx";
import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useCart } from "@/components/cart/cart-store";
import { useLenis } from "@/components/motion/SmoothScroll";
import { BottleImage, bottleAspect } from "@/components/media/BottleImage";
import { StageAnchor } from "@/components/stage/StageAnchor";
import { QUESTIONS, recommend } from "@/lib/finder";
import { worldVars, type Fragrance } from "@/lib/fragrance";
import { formatPrice } from "@/lib/money";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Find your world: three questions, then the answer lit on the stage. When the result appears the
 * stage washes the page into that world and the bottle fades in; Discover carries it across to its
 * product page.
 */
export function Finder({ fragrances }: { fragrances: Fragrance[] }) {
  const [answers, setAnswers] = useState<number[]>([]);
  const answered = useRef(false);
  const lenis = useLenis();
  const step = answers.length;
  const result = step >= QUESTIONS.length ? recommend(answers, fragrances) : null;

  // After each answer, focus moves to the new question (or the result) as it appears, for
  // keyboard and screen-reader users, and it glides into view if the answer was lower down (on
  // phones the list is taller than the screen). Never on first load.
  const heading = useCallback(
    (el: HTMLHeadingElement | null) => {
      if (!el || !answered.current) return;
      el.focus({ preventScroll: true });
      const top = el.getBoundingClientRect().top;
      if (top > 96 && top < window.innerHeight * 0.6) return;
      const y = window.scrollY + top - 140;
      if (lenis) lenis.scrollTo(y);
      else window.scrollTo({ top: y });
    },
    [lenis],
  );

  const choose = (i: number) => {
    answered.current = true;
    setAnswers((a) => [...a, i]);
  };
  const back = () => {
    answered.current = true;
    setAnswers((a) => a.slice(0, -1));
  };
  const restart = () => {
    answered.current = true;
    setAnswers([]);
  };

  return (
    <main
      id="main"
      className="world-surface text-world-ink relative min-h-svh"
      style={result ? worldVars(result) : undefined}
    >
      <div className="px-gutter grid min-h-svh grid-cols-12 content-start gap-x-4 gap-y-12 pt-32 pb-28 md:pt-44">
        <div className="col-span-12 md:col-span-3" data-enter>
          <h1 className="eyebrow opacity-70">Find your world</h1>
          <p className="mt-6 max-w-[16rem] text-sm leading-relaxed opacity-80">
            Three questions. Answer on instinct: the first image that pulls at you.
          </p>
          <ol aria-hidden className="mt-10 flex w-32 gap-1.5">
            {QUESTIONS.map((q, i) => (
              <li
                key={q.prompt}
                className={clsx(
                  "h-px flex-1 bg-current transition-opacity duration-700",
                  i < step ? "opacity-100" : "opacity-25",
                )}
              />
            ))}
          </ol>
        </div>

        {/* No [data-enter] here: this column will hold the result's stage anchor */}
        <div className="col-span-12 md:col-span-8 md:col-start-5">
          <AnimatePresence mode="wait" initial={false}>
            {result ? (
              <Result key="result" fragrance={result} heading={heading} onRestart={restart} />
            ) : (
              <motion.section
                key={step}
                aria-labelledby="finder-question"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.6, ease: EASE }}
              >
                <p className="eyebrow tabular-nums opacity-70">
                  {String(step + 1).padStart(2, "0")} / {String(QUESTIONS.length).padStart(2, "0")}
                  <span className="mx-3 inline-block h-px w-8 bg-current align-middle opacity-50" />
                  {QUESTIONS[step].hint}
                </p>
                <h2
                  id="finder-question"
                  ref={heading}
                  tabIndex={-1}
                  className="font-display text-headline mt-6 max-w-[18ch] outline-none"
                >
                  {QUESTIONS[step].prompt}
                </h2>
                <ol className="mt-12 border-t border-current/15">
                  {QUESTIONS[step].options.map((o, i) => (
                    <li key={o.label} className="border-b border-current/15">
                      <button
                        type="button"
                        onClick={() => choose(i)}
                        data-cursor="Choose"
                        className="group flex w-full items-baseline justify-between gap-6 py-5 text-left outline-offset-4"
                      >
                        <span className="display-italic text-[clamp(1.5rem,2.6vw,2.4rem)] leading-tight transition-transform duration-700 ease-(--ease-cinema) group-hover:translate-x-2 group-focus-visible:translate-x-2">
                          {o.label}
                        </span>
                        <span aria-hidden className="eyebrow tabular-nums opacity-60">
                          {String.fromCharCode(65 + i)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
                {step > 0 && (
                  <button
                    type="button"
                    onClick={back}
                    className="eyebrow mt-10 border-b border-current/40 pb-1"
                  >
                    Back
                  </button>
                )}
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}

function Result({
  fragrance: f,
  heading,
  onRestart,
}: {
  fragrance: Fragrance;
  heading: (el: HTMLHeadingElement | null) => void;
  onRestart: () => void;
}) {
  const { add } = useCart();
  const v = f.variants[0];
  return (
    <motion.section
      aria-labelledby="finder-result"
      className="grid grid-cols-8 items-center gap-x-4 gap-y-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.9, delay: 0.25, ease: EASE } }}
      exit={{ opacity: 0, transition: { duration: 0.5, ease: EASE } }}
    >
      <div className="col-span-8 md:col-span-4">
        <p className="eyebrow opacity-70">Your world</p>
        <h2
          id="finder-result"
          ref={heading}
          tabIndex={-1}
          className="font-display text-display mt-4 outline-none"
        >
          {f.name}
        </h2>
        <p className="display-italic mt-6 text-[clamp(1.4rem,2vw,2rem)] leading-snug">
          {f.tagline}
        </p>
        <p className="eyebrow mt-6 opacity-70">{f.mood}</p>
        <div className="mt-10 flex flex-wrap items-center gap-5">
          <Link
            href={`/fragrances/${f.slug}`}
            data-cursor="Discover"
            className="eyebrow border-b border-current pb-1"
          >
            Discover {f.name}
          </Link>
          {v && (
            <button
              type="button"
              data-cursor="Add"
              onClick={() =>
                add({
                  sku: v.sku,
                  slug: f.slug,
                  name: f.name,
                  sizeMl: v.sizeMl,
                  priceCents: v.priceCents,
                  currency: v.currency,
                  bottleImage: f.bottleImage,
                })
              }
              className="eyebrow bg-world-ink text-world-bg px-5 py-3.5 transition-opacity hover:opacity-85"
            >
              Add to bag · {formatPrice(v.priceCents, v.currency)}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onRestart}
          className="eyebrow mt-12 border-b border-current/40 pb-1 opacity-80"
        >
          Start again
        </button>
      </div>
      <div className="col-span-8 flex justify-center md:col-span-4">
        {/* The stage lights the bottle in its world here; the photo is the fallback */}
        <StageAnchor
          kind="product"
          slug={f.slug}
          className="relative h-[46svh] md:h-[62svh]"
          style={{ aspectRatio: bottleAspect(f.slug) }}
        >
          <div data-stage-fallback={f.slug} className="absolute inset-0">
            <BottleImage fragrance={f} fit="trim" sizes="(min-width: 768px) 32svh, 30svh" />
          </div>
        </StageAnchor>
      </div>
    </motion.section>
  );
}

"use client";

import { useId, useState } from "react";
import clsx from "clsx";

/** Three words. Choosing one (hover, focus or tap) shows what it means; the others step back. */
export function Pillars({
  heading,
  intro,
  items,
}: {
  heading: string;
  intro: string;
  items: { word: string; text: string }[];
}) {
  const id = useId();
  const [active, setActive] = useState(0);
  return (
    <section className="border-bone/15 mt-16 border-t pt-10" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="eyebrow text-bone-dim">
        {heading}
      </h2>
      <p className="font-display mt-5 max-w-xl text-3xl leading-snug">{intro}</p>
      <div role="tablist" aria-label={heading} className="mt-10 flex flex-wrap gap-x-8 gap-y-2">
        {items.map((it, i) => (
          <button
            key={it.word}
            id={`${id}-t${i}`}
            role="tab"
            type="button"
            aria-selected={active === i}
            aria-controls={`${id}-p`}
            onClick={() => setActive(i)}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            className={clsx(
              "font-display text-[clamp(2.25rem,4.4vw,3.75rem)] leading-tight transition-opacity duration-500",
              active === i ? "opacity-100" : "opacity-30 hover:opacity-60",
            )}
          >
            {active === i ? <span className="display-italic">{it.word}</span> : it.word}
          </button>
        ))}
      </div>
      <p
        id={`${id}-p`}
        role="tabpanel"
        aria-labelledby={`${id}-t${active}`}
        key={active}
        className="text-bone-dim info-reveal mt-6 max-w-md text-lg leading-relaxed"
      >
        {items[active]!.text}
      </p>
    </section>
  );
}

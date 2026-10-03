"use client";

import { useRef, useState } from "react";
import { Rich } from "./rich";

/**
 * Sections that open and close. Built on <details>, so it works (and stays readable) without
 * JavaScript; "Open all" opens every section at once. Opening fades the text in; nothing slides.
 */
export function Accordion({
  heading,
  items,
}: {
  heading?: string;
  items: { title: string; body: string[] }[];
}) {
  const root = useRef<HTMLDivElement>(null);
  const [allOpen, setAllOpen] = useState(false);

  function toggleAll() {
    const next = !allOpen;
    root.current?.querySelectorAll("details").forEach((d) => (d.open = next));
    setAllOpen(next);
  }

  return (
    <section className="mt-16">
      <div className="flex items-baseline justify-between gap-6">
        {heading ? <h2 className="display-italic text-3xl">{heading}</h2> : <span />}
        <button
          type="button"
          onClick={toggleAll}
          className="eyebrow text-bone-dim hover:text-bone shrink-0 transition-colors"
        >
          {allOpen ? "Close all" : "Open all"}
        </button>
      </div>
      <div ref={root} className="border-bone/15 divide-bone/15 mt-6 divide-y border-y">
        {items.map((it, i) => (
          <details
            key={it.title}
            className="group"
            onToggle={() => {
              const all = [...(root.current?.querySelectorAll("details") ?? [])];
              setAllOpen(all.every((d) => d.open));
            }}
          >
            <summary className="flex cursor-pointer list-none items-baseline gap-5 py-5 [&::-webkit-details-marker]:hidden">
              <span className="eyebrow text-bone-dim w-6 shrink-0 tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-display flex-1 text-2xl leading-snug">{it.title}</span>
              <Plus />
            </summary>
            <div className="text-bone-dim info-reveal space-y-3 pr-10 pb-7 pl-11 leading-relaxed">
              {it.body.map((p, j) => (
                <p key={j}>
                  <Rich text={p} />
                </p>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

/** A hairline plus that turns into a minus when open */
export function Plus() {
  return (
    <span aria-hidden className="relative size-3 shrink-0 self-center">
      <span className="absolute inset-x-0 top-1/2 h-px bg-current" />
      <span className="absolute inset-y-0 left-1/2 w-px bg-current transition-opacity duration-300 group-open:opacity-0" />
    </span>
  );
}

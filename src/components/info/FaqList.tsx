"use client";

import { useId, useState } from "react";
import { Plus } from "./Accordion";
import { Rich } from "./rich";

/** The questions, one open at a time, with a search that narrows them as you type */
export function FaqList({ items }: { items: { q: string; a: string[] }[] }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<number | null>(0);
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = items
    .map((it, i) => ({ ...it, i }))
    .filter((it) => {
      const hay = `${it.q} ${it.a.join(" ")}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });

  return (
    <section className="mt-14">
      <label htmlFor={`${id}-q`} className="eyebrow text-bone-dim">
        Search the answers
      </label>
      <div className="border-bone/30 focus-within:border-bone mt-3 flex items-end border-b">
        <input
          id={`${id}-q`}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Delivery, payment, longevity…"
          className="font-display placeholder:text-bone/25 w-full bg-transparent py-3 text-2xl focus:outline-none"
        />
      </div>
      <p aria-live="polite" className="text-bone-dim mt-3 min-h-5 text-sm">
        {words.length
          ? shown.length
            ? `${shown.length} of ${items.length}`
            : "Nothing yet. Ask us directly."
          : ""}
      </p>
      <ul className="border-bone/15 divide-bone/15 mt-4 divide-y border-y">
        {shown.map((it) => {
          const isOpen = open === it.i || words.length > 0;
          return (
            <li
              key={it.i}
              className={isOpen ? "group open" : "group"}
              data-open={isOpen || undefined}
            >
              <h3>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`${id}-a${it.i}`}
                  onClick={() => setOpen(open === it.i ? null : it.i)}
                  className="flex w-full items-baseline gap-5 py-5 text-left"
                >
                  <span className="font-display flex-1 text-2xl leading-snug">{it.q}</span>
                  <Plus />
                </button>
              </h3>
              <div
                id={`${id}-a${it.i}`}
                hidden={!isOpen}
                className="text-bone-dim info-reveal space-y-3 pr-10 pb-7 leading-relaxed"
              >
                {it.a.map((p, j) => (
                  <p key={j}>
                    <Rich text={p} />
                  </p>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

"use client";

import { useId, useState } from "react";
import clsx from "clsx";
import { CONTACT } from "@/lib/contact";
import { Rich } from "./rich";

type Option = {
  label: string;
  verdict: "covered" | "not-covered";
  answer: string[];
  steps?: string[];
};

/** "What happened?": choose the case that fits, and the answer appears beside it */
export function Chooser({
  heading,
  intro,
  options,
}: {
  heading: string;
  intro?: string;
  options: Option[];
}) {
  const id = useId();
  const [pick, setPick] = useState<number | null>(null);
  const chosen = pick === null ? null : options[pick];
  const whatsapp = `https://wa.me/${CONTACT.phone.replace(/\D/g, "")}`;

  return (
    <section className="border-bone/15 mt-16 border-t pt-10" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="display-italic text-4xl">
        {heading}
      </h2>
      {intro && <p className="text-bone-dim mt-3">{intro}</p>}
      <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div role="radiogroup" aria-labelledby={`${id}-h`} className="flex flex-col">
          {options.map((o, i) => (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={pick === i}
              onClick={() => setPick(i)}
              className={clsx(
                "border-bone/15 flex items-center justify-between gap-4 border-b py-4 text-left transition-colors",
                pick === i ? "text-bone" : "text-bone-dim hover:text-bone",
              )}
            >
              <span className="font-display text-xl">{o.label}</span>
              <span
                aria-hidden
                className={clsx(
                  "size-2 shrink-0 border border-current transition-opacity",
                  pick === i ? "bg-current opacity-100" : "opacity-40",
                )}
              />
            </button>
          ))}
        </div>
        <div aria-live="polite" className="border-bone/15 min-h-56 border p-6 md:p-8">
          {chosen ? (
            <div key={pick} className="info-reveal">
              <p className="eyebrow">{chosen.verdict === "covered" ? "Covered" : "Not covered"}</p>
              <div className="text-bone-dim mt-5 space-y-3 leading-relaxed">
                {chosen.answer.map((p, j) => (
                  <p key={j}>
                    <Rich text={p} />
                  </p>
                ))}
              </div>
              {chosen.steps && (
                <>
                  <p className="eyebrow text-bone-dim mt-7">Send us</p>
                  <ol className="mt-3 space-y-2">
                    {chosen.steps.map((s, j) => (
                      <li key={s} className="flex gap-4">
                        <span className="eyebrow text-bone-dim pt-1 tabular-nums">{`0${j + 1}`}</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3">
                    <a
                      href={whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="eyebrow border-b border-current pb-1"
                    >
                      WhatsApp us
                    </a>
                    <a
                      href={`mailto:${CONTACT.email}?subject=Order%20claim`}
                      className="eyebrow border-b border-current pb-1"
                    >
                      Email us
                    </a>
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="font-display text-bone-dim text-2xl leading-snug">
              Choose what happened, and the answer appears here.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

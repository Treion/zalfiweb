"use client";

import { useId, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { NewsletterResult } from "@/app/api/newsletter/route";

type UiState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

const EASE = [0.22, 1, 0.36, 1] as const;

/** Newsletter sign-up, saved to Postgres through /api/newsletter. */
export function Newsletter() {
  const id = useId();
  const [state, setState] = useState<UiState>({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setState({ kind: "error", message: "That email doesn't look right." });
      return;
    }
    if (form.get("consent") !== "on") {
      setState({ kind: "error", message: "Please confirm you'd like to hear from us." });
      return;
    }
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          consent: true,
          company: String(form.get("company") ?? ""),
          source: "home",
        }),
      });
      const data = (await res.json()) as NewsletterResult;
      if (data.status === "subscribed")
        setState({
          kind: "done",
          message: "You're on the list. The next letter comes to you first.",
        });
      else if (data.status === "already")
        setState({ kind: "done", message: "You're already on the list. We'll write soon." });
      else if (data.status === "invalid") setState({ kind: "error", message: data.message });
      else
        setState({
          kind: "error",
          message: "Sign-ups are resting for a moment. Please try again shortly.",
        });
    } catch {
      setState({ kind: "error", message: "We couldn't reach the house. Please try again." });
    }
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="bg-noir-soft px-gutter text-bone relative py-28 md:py-40"
    >
      <div className="grid grid-cols-12 gap-x-4 gap-y-12">
        <div className="col-span-12 md:col-span-6">
          <p className="eyebrow text-bone-dim">Letters from the house</p>
          <h2
            id={`${id}-title`}
            className="font-display mt-6 text-[clamp(2.6rem,5.6vw,6rem)] leading-[0.95]"
          >
            First to smell
            <br />
            <span className="display-italic">what&rsquo;s next.</span>
          </h2>
        </div>

        <div className="col-span-12 self-end md:col-span-5 md:col-start-8">
          <AnimatePresence mode="wait" initial={false}>
            {state.kind === "done" ? (
              <motion.p
                key="done"
                role="status"
                className="display-italic text-3xl leading-snug"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: EASE }}
              >
                {state.message}
              </motion.p>
            ) : (
              <motion.form
                key="form"
                onSubmit={onSubmit}
                noValidate
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: EASE }}
              >
                <p className="text-bone-dim mb-8 max-w-sm text-sm leading-relaxed">
                  New worlds, early access and the occasional story. A few letters a year, never
                  more.
                </p>
                <label htmlFor={`${id}-email`} className="eyebrow text-bone-dim">
                  Email address
                </label>
                <div className="border-bone/30 focus-within:border-bone mt-3 flex items-end gap-4 border-b">
                  <input
                    id={`${id}-email`}
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    aria-invalid={state.kind === "error" || undefined}
                    aria-describedby={`${id}-msg`}
                    className="font-display placeholder:text-bone/25 w-full bg-transparent py-3 text-2xl focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={state.kind === "sending"}
                    data-cursor="Join"
                    className="eyebrow shrink-0 pb-4 disabled:opacity-50"
                  >
                    {state.kind === "sending" ? "Sending" : "Subscribe"}
                  </button>
                </div>
                {/* Honeypot: hidden from people and assistive tech */}
                <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
                  <label>
                    Company
                    <input name="company" tabIndex={-1} autoComplete="off" />
                  </label>
                </div>
                <label className="text-bone-dim mt-6 flex items-start gap-3 text-xs leading-relaxed">
                  <input
                    name="consent"
                    type="checkbox"
                    required
                    className="border-bone/40 checked:border-bone checked:bg-bone mt-0.5 size-4 shrink-0 appearance-none border"
                  />
                  Yes, send me letters from ZALFI. I can unsubscribe at any time.
                </label>
                <p id={`${id}-msg`} role="alert" className="mt-4 min-h-5 text-sm text-[#f0b8a8]">
                  {state.kind === "error" ? state.message : ""}
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

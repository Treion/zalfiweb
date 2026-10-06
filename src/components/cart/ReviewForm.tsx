"use client";

import { useId, useState } from "react";
import clsx from "clsx";
import { StarMark } from "@/components/product/Stars";
import { REVIEW_BODY_MAX, REVIEW_NAME_MAX } from "@/lib/reviews";
import type { OrderReviewLine } from "@/server/reviews";

type Status = NonNullable<OrderReviewLine["review"]>["status"];

const DONE: Record<Status, string> = {
  pending: "Thank you. We read every review before it shows.",
  approved: "Your review is on the shop. Thank you.",
  rejected: "Thank you for your review.",
};

/**
 * "Review your fragrances", on a delivered order's own page: one short form per line. A review
 * waits for the house to read it before it shows on the shop.
 */
export function ReviewForms({
  token,
  lines,
  signature,
}: {
  token: string;
  lines: OrderReviewLine[];
  signature: string;
}) {
  return (
    <ul className="divide-noir/10 border-noir/15 divide-y border-y">
      {lines.map((l) => (
        <li key={l.itemId} className="py-8">
          <p className="font-display text-3xl leading-none">{l.name}</p>
          <p className="text-smoke mt-1 text-sm">{l.size}</p>
          {l.review ? (
            <p className="mt-4 text-sm" role="status">
              {DONE[l.review.status]}
            </p>
          ) : (
            <LineForm token={token} itemId={l.itemId} name={l.name} signature={signature} />
          )}
        </li>
      ))}
    </ul>
  );
}

function LineForm({
  token,
  itemId,
  name,
  signature,
}: {
  token: string;
  itemId: number;
  name: string;
  signature: string;
}) {
  const id = useId();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");
  const [sign, setSign] = useState(signature);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  if (sent)
    return (
      <p className="mt-4 text-sm" role="status">
        {DONE.pending}
      </p>
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return setError("Choose a rating.");
    if (!sign.trim()) return setError("Add how to sign it.");
    setBusy(true);
    setError("");
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, itemId, rating, body, name: sign }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    setBusy(false);
    if (res?.ok && data?.ok) return setSent(true);
    setError(data?.error ?? "We couldn't send it. Try again in a moment.");
  }

  const shown = hover || rating;
  return (
    <form onSubmit={submit} className="mt-6 space-y-6" noValidate>
      <fieldset>
        <legend className="eyebrow text-smoke">Your rating</legend>
        <div className="mt-2 flex gap-1 text-2xl" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              className="has-focus-visible:outline-noir cursor-pointer p-1 has-focus-visible:outline has-focus-visible:outline-1"
              onMouseEnter={() => setHover(n)}
            >
              <input
                type="radio"
                name={`${id}-rating`}
                value={n}
                checked={rating === n}
                onChange={() => setRating(n)}
                className="sr-only"
                aria-label={`${n} out of 5 for ${name}`}
              />
              <StarMark filled={n <= shown} />
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor={`${id}-body`} className="eyebrow text-smoke">
          How does it wear?
        </label>
        <textarea
          id={`${id}-body`}
          rows={3}
          maxLength={REVIEW_BODY_MAX}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Where you wore it, how long it lasted, what people said."
          className="border-noir/20 focus:border-noir placeholder:text-noir/30 mt-2 block w-full resize-none border-b bg-transparent py-3 text-lg outline-none"
        />
      </div>
      <div>
        <label htmlFor={`${id}-sign`} className="eyebrow text-smoke">
          Signed
        </label>
        <input
          id={`${id}-sign`}
          value={sign}
          maxLength={REVIEW_NAME_MAX}
          onChange={(e) => setSign(e.target.value)}
          autoComplete="off"
          className="border-noir/20 focus:border-noir mt-2 block w-full border-b bg-transparent py-3 text-lg outline-none"
        />
      </div>
      <p role="alert" className={clsx("text-alert text-sm", !error && "sr-only")}>
        {error}
      </p>
      <button
        type="submit"
        disabled={busy}
        className="eyebrow bg-noir text-bone px-8 py-4 transition-opacity disabled:opacity-60"
      >
        {busy ? "Sending" : "Send review"}
      </button>
    </form>
  );
}

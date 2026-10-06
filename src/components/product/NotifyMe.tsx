"use client";

import clsx from "clsx";
import { useId, useState } from "react";

/**
 * Sold out: leave a mobile number, get one SMS when it's back. Nothing else is sent to it.
 * `tone` follows the surface: the fragrance's world ink, or noir on bone paper.
 */
export function NotifyMe({
  sku,
  name,
  className,
}: {
  sku: string;
  name: string;
  className?: string;
}) {
  const id = useId();
  const [state, setState] = useState<"idle" | "busy" | "done" | "back">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("busy");
    setError("");
    const phone = new FormData(e.currentTarget).get("phone");
    const res = await fetch("/api/restock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku, phone }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as {
      status?: "waiting" | "in_stock";
      error?: string;
    } | null;
    if (res?.ok && data?.status) return setState(data.status === "in_stock" ? "back" : "done");
    setState("idle");
    setError(data?.error ?? "Something went wrong. Try again in a moment.");
  }

  if (state === "done")
    return (
      <p className={clsx("text-sm", className)} role="status">
        We&rsquo;ll text you once when {name} is back.
      </p>
    );
  if (state === "back")
    return (
      <p className={clsx("text-sm", className)} role="status">
        {name} is back in stock. Reload the page to add it.
      </p>
    );
  return (
    <form onSubmit={submit} className={clsx("text-sm", className)} noValidate>
      <label htmlFor={`${id}-phone`} className="block">
        Sold out for now. Leave your number, and we&rsquo;ll text you when it&rsquo;s back.
      </label>
      <div className="mt-3 flex gap-2">
        <input
          id={`${id}-phone`}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          placeholder="01XXXXXXXXX"
          className="min-w-0 flex-1 border-b border-current/40 bg-transparent py-2 outline-none focus:border-current"
        />
        <button
          type="submit"
          disabled={state === "busy"}
          className="eyebrow border border-current px-4 py-2 transition-opacity disabled:opacity-50"
        >
          Notify me
        </button>
      </div>
      <p role="alert" className="mt-2 min-h-4 text-xs">
        {error}
      </p>
    </form>
  );
}

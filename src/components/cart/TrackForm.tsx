"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

/** Order number + phone → the order's own page (or one plain message) */
export function TrackForm() {
  const id = useId();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    const res = await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: form.get("number"), phone: form.get("phone") }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { next?: string; error?: string } | null;
    if (res?.ok && data?.next) return router.push(data.next);
    setBusy(false);
    setError(data?.error ?? "Something went wrong. Try again in a moment.");
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-8" noValidate>
      <label className="block" htmlFor={`${id}-number`}>
        <span className="eyebrow text-smoke">Order number</span>
        <input
          id={`${id}-number`}
          name="number"
          required
          autoComplete="off"
          placeholder="ZLF-001234"
          className="border-noir/30 focus:border-noir mt-2 block w-full border-b bg-transparent py-3 text-xl outline-none"
        />
        <span className="text-smoke mt-2 block text-xs">On your receipt and in the SMS.</span>
      </label>
      <label className="block" htmlFor={`${id}-phone`}>
        <span className="eyebrow text-smoke">Mobile number you ordered with</span>
        <input
          id={`${id}-phone`}
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          inputMode="tel"
          placeholder="01XXXXXXXXX"
          className="border-noir/30 focus:border-noir mt-2 block w-full border-b bg-transparent py-3 text-xl outline-none"
        />
      </label>
      <p role="alert" className="text-alert min-h-5 text-sm">
        {error}
      </p>
      <button
        type="submit"
        disabled={busy}
        data-cursor="Track"
        className="eyebrow bg-noir text-bone w-full py-5 transition-opacity disabled:opacity-60"
      >
        {busy ? "Looking" : "Find my order"}
      </button>
    </form>
  );
}

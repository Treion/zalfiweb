"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/money";

/** "Pay now" on an unpaid order's page: opens a new payment attempt at the provider */
export function PayNow({ token, total }: { token: string; total: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ o: token }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (res.ok && data.url) return void window.location.assign(data.url);
      setError(data.error ?? "We couldn't open the payment page. Try again.");
    } catch {
      setError("We couldn't reach the payment page. Check your connection.");
    }
    setBusy(false);
  }
  return (
    <div className="mt-10 max-w-sm">
      <button
        type="button"
        onClick={pay}
        disabled={busy}
        data-cursor="Pay"
        className="eyebrow bg-noir text-bone w-full py-5 transition-opacity disabled:opacity-60"
      >
        {busy ? "Opening the payment page" : `Pay now · ${formatPrice(total)}`}
      </button>
      <p role="alert" className="text-alert mt-3 min-h-5 text-sm">
        {error ?? ""}
      </p>
    </div>
  );
}

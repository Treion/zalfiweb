"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatPrice } from "@/lib/money";
import { formatPhone } from "@/lib/phone";

export type WalletOption = {
  wallet: "bkash" | "nagad";
  label: string;
  number: string;
  accountType: "personal" | "merchant" | "agent";
};

/** What the customer taps in their wallet app, by the kind of account the shop has */
const HOW: Record<WalletOption["accountType"], string> = {
  personal: "Send Money",
  merchant: "Payment",
  agent: "Cash In",
};

/**
 * bKash or Nagad, by hand, on the order's page: where to send the money, then the transaction ID.
 * The team checks it in the wallet app and confirms the order.
 */
export function ManualPay({
  token,
  total,
  reference,
  wallets,
}: {
  token: string;
  total: number;
  reference: string;
  wallets: WalletOption[];
}) {
  const router = useRouter();
  const [wallet, setWallet] = useState(wallets[0]?.wallet ?? "bkash");
  const [sender, setSender] = useState("");
  const [trxId, setTrxId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = wallets.find((w) => w.wallet === wallet) ?? wallets[0];
  if (!chosen) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ o: token, wallet, sender, trxId }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) return void router.refresh();
      setError(data.error ?? "That didn't go through. Try again.");
    } catch {
      setError("We couldn't reach the shop. Check your connection.");
    }
    setBusy(false);
  }

  const field =
    "border-noir/25 focus:border-noir w-full border-b bg-transparent py-3 text-lg outline-none transition-colors";
  return (
    <div className="mt-10 max-w-md">
      {wallets.length > 1 && (
        <div role="radiogroup" aria-label="Pay with" className="mb-6 flex gap-6">
          {wallets.map((w) => (
            <button
              key={w.wallet}
              type="button"
              role="radio"
              aria-checked={wallet === w.wallet}
              onClick={() => setWallet(w.wallet)}
              className={`eyebrow border-b pb-1 transition-opacity ${
                wallet === w.wallet ? "border-noir" : "border-transparent opacity-50"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      )}
      <ol className="border-noir/15 space-y-3 border-y py-6 text-sm leading-relaxed">
        <li>
          <span className="eyebrow text-smoke mr-3">1</span>
          In {chosen.label}, choose <strong>{HOW[chosen.accountType]}</strong>.
        </li>
        <li>
          <span className="eyebrow text-smoke mr-3">2</span>
          Send <strong className="tabular-nums">{formatPrice(total)}</strong> to{" "}
          <strong className="tabular-nums">{formatPhone(chosen.number)}</strong>.
        </li>
        <li>
          <span className="eyebrow text-smoke mr-3">3</span>
          Write <strong>{reference}</strong> as the reference.
        </li>
        <li>
          <span className="eyebrow text-smoke mr-3">4</span>
          Enter the transaction ID from the confirmation below.
        </li>
      </ol>
      <form onSubmit={submit} className="mt-6 space-y-6">
        <label className="block">
          <span className="eyebrow text-smoke">Sent from (your {chosen.label} number)</span>
          <input
            className={field}
            inputMode="tel"
            autoComplete="tel"
            placeholder="01XXXXXXXXX"
            value={sender}
            onChange={(e) => setSender(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="eyebrow text-smoke">Transaction ID (TrxID)</span>
          <input
            className={`${field} font-mono uppercase`}
            autoComplete="off"
            spellCheck={false}
            placeholder={chosen.wallet === "bkash" ? "e.g. 9GH4K2LMNP" : "e.g. 7A1B2C3D"}
            value={trxId}
            onChange={(e) => setTrxId(e.target.value)}
            required
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          data-cursor="Send"
          className="eyebrow bg-noir text-bone w-full py-5 transition-opacity disabled:opacity-60"
        >
          {busy ? "Sending" : "I've paid: send the transaction ID"}
        </button>
        <p role="alert" className="text-alert min-h-5 text-sm">
          {error ?? ""}
        </p>
      </form>
    </div>
  );
}

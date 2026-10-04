import { createHmac, timingSafeEqual } from "node:crypto";
import { appSecret } from "@/server/secret";
import type { Notice, PaymentProvider, Validation } from "./types";

/**
 * The test gateway: a page on this site with Succeed / Fail / Cancel buttons (checkout/pay/mock).
 * It behaves like SSLCommerz where it matters: it posts a signed notice to the IPN endpoint, sends
 * the customer back with the same notice, and a payment is only paid once `validate` confirms it.
 * Its validation IDs carry the amount and an HMAC, so nothing about a test payment can be forged.
 * No money moves; it is refused on the live site (see providers.ts).
 */
const sign = (s: string) => createHmac("sha256", appSecret()).update(`mock-pay:${s}`).digest("hex");

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export type MockOutcome = "success" | "fail" | "cancel" | "wrong-amount";

/** The notice the test gateway posts for an outcome (also the form the test page submits) */
export function mockNotice(tranId: string, amount: number, outcome: MockOutcome): Notice {
  const status = outcome === "fail" ? "FAILED" : outcome === "cancel" ? "CANCELLED" : "VALID";
  const paid = outcome === "wrong-amount" ? amount + 100 : amount;
  const valId = status === "VALID" ? `mock.${tranId}.${paid}.${sign(`val:${tranId}:${paid}`)}` : "";
  return {
    tran_id: tranId,
    status,
    val_id: valId,
    card_type: "MOCK-Test card",
    mock_sig: sign(`notice:${tranId}:${status}:${valId}`),
  };
}

export const mockProvider: PaymentProvider = {
  name: "mock",
  mode: "test",
  refunds: "api",

  async createSession(input) {
    return { url: `/checkout/pay/mock?t=${encodeURIComponent(input.tranId)}`, raw: { mock: true } };
  },

  handleIpn(n) {
    const status = (n.status ?? "").toUpperCase();
    const expected = sign(`notice:${n.tran_id ?? ""}:${status}:${n.val_id ?? ""}`);
    return {
      tranId: n.tran_id ?? "",
      valId: n.val_id || null,
      status:
        status === "VALID"
          ? "valid"
          : status === "FAILED"
            ? "failed"
            : status === "CANCELLED"
              ? "cancelled"
              : "unknown",
      authentic: !!n.mock_sig && same(n.mock_sig, expected),
    };
  },

  async validate(valId) {
    const [, tranId = "", amount = "", sig = ""] = valId.split(".");
    const ok = !!sig && same(sig, sign(`val:${tranId}:${amount}`));
    const v: Validation = {
      valid: ok,
      status: ok ? "VALID" : "INVALID_TRANSACTION",
      tranId,
      valId,
      amount: Number(amount),
      currency: "BDT",
      method: "MOCK-Test card",
      bankTranId: ok ? `MOCKBANK-${tranId}` : null,
      risky: false,
      riskTitle: null,
      raw: { mock: true, valId },
    };
    return v;
  },

  async getTransaction() {
    // The test gateway keeps no records of its own: it only knows what it signed
    return null;
  },

  async refund({ refundKey, amount }) {
    return {
      status: "completed",
      providerRef: `MOCKREF-${refundKey}`,
      error: null,
      raw: { mock: true, amount },
    };
  },

  async refundStatus(providerRef) {
    return { status: "completed", providerRef, error: null, raw: { mock: true } };
  },
};

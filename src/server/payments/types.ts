/**
 * Taking money online, behind one interface. Three providers implement it:
 *  - sslcommerz: SSLCommerz, sandbox or live.
 *  - aamarpay: aamarPay, sandbox or live.
 *  - mock: a test gateway inside this site (Succeed / Fail / Cancel), for development and
 *    previews. No money moves. Refused on the live site.
 * Each is set up and switched on in Admin → Integrations. Checkout tries them in the owner's order
 * and falls back to the next if one can't open a payment page.
 *
 * The rule that matters: an order is paid only after the server has validated the payment with
 * the provider (status, amount, currency and transaction ID all match). The browser coming back
 * to the success page proves nothing on its own.
 */

export const GATEWAYS = ["sslcommerz", "aamarpay"] as const;
export type GatewayName = (typeof GATEWAYS)[number];
export type ProviderName = GatewayName | "mock";

/** What the customer's order looks like to a payment page */
export type SessionInput = {
  tranId: string;
  /** Poisha */
  amount: number;
  orderNumber: string;
  customer: { name: string; email: string; phone: string; address: string; district: string };
  items: { name: string; qty: number }[];
  urls: { success: string; fail: string; cancel: string; ipn: string };
};

export type Session = {
  /** Where to send the customer: the provider's payment page */
  url: string;
  /** Kept for auditing (never holds a secret) */
  raw: unknown;
};

/** A notice the provider posts: to the IPN endpoint, or with the customer back to the shop */
export type Notice = Record<string, string>;

export type ParsedNotice = {
  tranId: string;
  valId: string | null;
  /** The provider's word for what happened */
  status: "valid" | "failed" | "cancelled" | "expired" | "unattempted" | "unknown";
  /**
   * Whether the notice's signature checks out (where the provider signs notices). An unsigned
   * failure is recorded only once the provider's own transaction check confirms it.
   */
  authentic: boolean;
};

/** The provider's own answer when asked about a payment (the validation API) */
export type Validation = {
  /** Valid means the provider confirms the money was taken */
  valid: boolean;
  status: string;
  tranId: string;
  valId: string | null;
  /** Poisha, as the provider reports it */
  amount: number;
  currency: string;
  /** As the provider reports it: "BKASH-BKash", "VISA-Dutch Bangla", … */
  method: string | null;
  /** The bank's transaction ID, needed to refund */
  bankTranId: string | null;
  /** The provider's risk flag: high risk should be checked before packing */
  risky: boolean;
  riskTitle: string | null;
  raw: unknown;
};

export type RefundResult = {
  status: "pending" | "completed" | "failed";
  providerRef: string | null;
  error: string | null;
  raw: unknown;
};

export interface PaymentProvider {
  readonly name: ProviderName;
  /** "test" (mock), "sandbox" or "live" */
  readonly mode: "test" | "sandbox" | "live";
  /** "api": refunds go through the provider. "panel": made in its merchant panel, recorded here. */
  readonly refunds: "api" | "panel";
  createSession(input: SessionInput): Promise<Session>;
  /** Reads (and authenticates) a posted notice. Doesn't change anything. */
  handleIpn(notice: Notice): ParsedNotice;
  /** Asks the provider whether a payment really went through */
  validate(valId: string): Promise<Validation>;
  /** The provider's latest record of a transaction, if any (for missed notices) */
  getTransaction(tranId: string): Promise<Validation | null>;
  refund(input: {
    tranId: string;
    bankTranId: string | null;
    amount: number;
    reason: string;
    refundKey: string;
  }): Promise<RefundResult>;
  refundStatus(providerRef: string): Promise<RefundResult>;
}

/** Poisha → the provider's decimal taka string: 457000 → "4570.00" */
export const toTaka = (poisha: number) => (poisha / 100).toFixed(2);
/** The provider's decimal taka → poisha: "4570.00" → 457000 (NaN stays NaN) */
export const fromTaka = (taka: string | number | undefined | null) =>
  Math.round(Number(taka) * 100);

/** Why a validation doesn't prove this payment, or null when it does (every provider) */
export function mismatch(v: Validation, expected: { tranId: string; amount: number }) {
  if (!v.valid) return `the provider says ${v.status || "no such payment"}`;
  if (v.tranId !== expected.tranId) return `transaction ${v.tranId} isn't ${expected.tranId}`;
  if (v.currency !== "BDT") return `currency ${v.currency || "missing"} isn't BDT`;
  if (!Number.isFinite(v.amount) || v.amount !== expected.amount)
    return `amount ${toTaka(v.amount)} isn't ${toTaka(expected.amount)}`;
  return null;
}

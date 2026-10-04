import {
  fromTaka,
  toTaka,
  type Notice,
  type ParsedNotice,
  type PaymentProvider,
  type SessionInput,
  type Validation,
} from "./types";

/**
 * aamarPay (aamarpay.com), following its developer documentation:
 *  - session:     POST {base}/jsonpost.php (JSON, type "json")          → { result, payment_url }
 *  - transaction: GET  {base}/api/v1/trxcheck/request.php?request_id=…  (our tran_id)
 * The sandbox is https://sandbox.aamarpay.com; live is https://secure.aamarpay.com.
 *
 * aamarPay's callbacks (to the success, fail and cancel addresses, and an IPN if aamarPay sets
 * one up) carry no signature. So none is trusted on its own: a payment is paid only when the
 * transaction check says "Successful" for our transaction ID, amount and currency, and a failure
 * is recorded only when the check confirms it. aamarPay has no refund API: refunds are made in its
 * merchant panel and recorded in the admin.
 */

export type AamarConfig = { storeId: string; signatureKey: string; live: boolean };

export const aamarBase = (live: boolean) =>
  live ? "https://secure.aamarpay.com" : "https://sandbox.aamarpay.com";

/** The session request's JSON body */
export function sessionBody(cfg: AamarConfig, s: SessionInput) {
  const items = s.items
    .map((i) => (i.qty > 1 ? `${i.name} x${i.qty}` : i.name))
    .join(", ")
    .slice(0, 200);
  return {
    store_id: cfg.storeId,
    signature_key: cfg.signatureKey,
    tran_id: s.tranId,
    amount: toTaka(s.amount),
    currency: "BDT",
    desc: `${s.orderNumber}: ${items}`,
    cus_name: s.customer.name,
    cus_email: s.customer.email,
    cus_phone: s.customer.phone,
    cus_add1: s.customer.address.slice(0, 100),
    cus_add2: "",
    cus_city: s.customer.district,
    cus_country: "Bangladesh",
    success_url: s.urls.success,
    fail_url: s.urls.fail,
    cancel_url: s.urls.cancel,
    opt_a: s.orderNumber,
    type: "json",
  };
}

/** Reads the session answer: the payment page's URL, or aamarPay's reason for refusing */
export function parseSession(body: unknown) {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    const url = typeof b.payment_url === "string" ? b.payment_url : "";
    if (String(b.result) === "true" && url) return { ok: true as const, url };
    const reason = b.reason ?? b.message ?? b.error ?? b.result;
    if (reason && typeof reason === "object")
      return { ok: false as const, error: Object.values(reason).join(" ") };
    return { ok: false as const, error: String(reason ?? "aamarPay didn't open a session") };
  }
  const text = typeof body === "string" ? body.trim() : "";
  return { ok: false as const, error: text.slice(0, 200) || "aamarPay didn't open a session" };
}

/**
 * Reads a callback. Our own addresses add `_tran` and `_outcome` (aamarPay's cancel address
 * receives no fields at all), so every callback can be matched to its payment.
 */
export function parseNotice(notice: Notice): ParsedNotice {
  const tranId = notice.mer_txnid || notice._tran || "";
  const pay = (notice.pay_status ?? "").toLowerCase();
  const outcome = notice._outcome ?? "";
  const status: ParsedNotice["status"] =
    pay === "successful"
      ? "valid"
      : pay === "failed"
        ? "failed"
        : pay === "cancelled" || outcome === "cancel"
          ? "cancelled"
          : outcome === "fail"
            ? "failed"
            : outcome === "success"
              ? "valid"
              : "unknown";
  // The transaction check is asked by our transaction ID, so that is the "validation" handle
  return { tranId, valId: status === "valid" ? tranId : null, status, authentic: false };
}

/** The transaction check's answer, in our terms */
export function parseTrxCheck(body: unknown): Validation | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const s = (k: string) => (b[k] === undefined || b[k] === null ? "" : String(b[k]));
  if (!s("mer_txnid") && !s("pay_status")) return null;
  const status = s("pay_status").toUpperCase();
  const code = s("status_code");
  return {
    valid: status === "SUCCESSFUL" && (code === "" || code === "2"),
    status,
    tranId: s("mer_txnid"),
    valId: s("pg_txnid") || null,
    amount: fromTaka(s("amount_bdt") || s("amount")),
    currency: s("currency_merchant") || s("currency"),
    method: s("payment_type") || s("card_type") || s("payment_processor") || null,
    bankTranId: s("bank_trxid") || s("bank_txn") || null,
    risky: s("risk_level") === "1",
    riskTitle: s("risk_title") && s("risk_title") !== "Safe" ? s("risk_title") : null,
    raw: Object.fromEntries(Object.entries(b).filter(([k]) => k !== "signature_key")),
  };
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => "");
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function aamarpay(cfg: AamarConfig): PaymentProvider {
  const base = aamarBase(cfg.live);
  const getTransaction = async (tranId: string) => {
    const q = new URLSearchParams({
      request_id: tranId,
      store_id: cfg.storeId,
      signature_key: cfg.signatureKey,
      type: "json",
    });
    const res = await fetch(`${base}/api/v1/trxcheck/request.php?${q}`, {
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    return parseTrxCheck(await readBody(res));
  };
  return {
    name: "aamarpay",
    mode: cfg.live ? "live" : "sandbox",
    refunds: "panel",

    async createSession(input) {
      const res = await fetch(`${base}/jsonpost.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionBody(cfg, input)),
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      const parsed = parseSession(await readBody(res));
      if (!parsed.ok) throw new Error(parsed.error);
      return { url: parsed.url, raw: { payment_url: parsed.url } };
    },

    handleIpn(notice) {
      return parseNotice(notice);
    },

    async validate(tranId) {
      return (
        (await getTransaction(tranId)) ?? {
          valid: false,
          status: "NOT FOUND",
          tranId,
          valId: null,
          amount: NaN,
          currency: "",
          method: null,
          bankTranId: null,
          risky: false,
          riskTitle: null,
          raw: null,
        }
      );
    },

    getTransaction,

    // No refund API: the admin records a refund made in aamarPay's merchant panel
    async refund() {
      return {
        status: "failed",
        providerRef: null,
        error: "Refund it in the aamarPay merchant panel, then record it here.",
        raw: null,
      };
    },

    async refundStatus(providerRef) {
      return { status: "completed", providerRef, error: null, raw: null };
    },
  };
}

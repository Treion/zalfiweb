import { createHash } from "node:crypto";
import {
  fromTaka,
  toTaka,
  type Notice,
  type ParsedNotice,
  type PaymentProvider,
  type RefundResult,
  type SessionInput,
  type Validation,
} from "./types";

/**
 * SSLCommerz (sslcommerz.com), following its developer documentation (API v4):
 *  - session:     POST {base}/gwprocess/v4/api.php                    → GatewayPageURL
 *  - validation:  GET  {base}/validator/api/validationserverAPI.php    (val_id)
 *  - transaction: GET  {base}/validator/api/merchantTransIDvalidationAPI.php (tran_id)
 *  - refund:      GET  {base}/validator/api/merchantTransIDvalidationAPI.php (bank_tran_id, refund_amount)
 *  - refund status: the same endpoint with refund_ref_id
 * The sandbox is https://sandbox.sslcommerz.com; live is https://securepay.sslcommerz.com.
 *
 * The pure functions below (form building, signature, validation matching) are unit-tested with
 * sample payloads; the provider wires them to fetch.
 */

export type SslConfig = { storeId: string; storePassword: string; live: boolean };

export const sslBase = (live: boolean) =>
  live ? "https://securepay.sslcommerz.com" : "https://sandbox.sslcommerz.com";

const md5 = (s: string) => createHash("md5").update(s).digest("hex");

/** The session request's form fields. SSLCommerz requires a postcode; we don't collect one. */
export function sessionForm(cfg: SslConfig, s: SessionInput): Record<string, string> {
  return {
    store_id: cfg.storeId,
    store_passwd: cfg.storePassword,
    total_amount: toTaka(s.amount),
    currency: "BDT",
    tran_id: s.tranId,
    success_url: s.urls.success,
    fail_url: s.urls.fail,
    cancel_url: s.urls.cancel,
    ipn_url: s.urls.ipn,
    cus_name: s.customer.name,
    cus_email: s.customer.email,
    cus_phone: s.customer.phone,
    cus_add1: s.customer.address.slice(0, 50),
    cus_city: s.customer.district,
    cus_state: s.customer.district,
    cus_postcode: "0000",
    cus_country: "Bangladesh",
    shipping_method: "NO",
    num_of_item: String(s.items.reduce((n, i) => n + i.qty, 0)),
    product_name: s.items
      .map((i) => (i.qty > 1 ? `${i.name} x${i.qty}` : i.name))
      .join(", ")
      .slice(0, 250),
    product_category: "Perfume",
    product_profile: "physical-goods",
    value_a: s.orderNumber,
  };
}

/** Reads the session response: the payment page's URL, or the reason it failed */
export function parseSession(body: Record<string, unknown>) {
  const status = String(body.status ?? "");
  const url = typeof body.GatewayPageURL === "string" ? body.GatewayPageURL : "";
  if (status === "SUCCESS" && url) return { ok: true as const, url };
  return {
    ok: false as const,
    error: String(body.failedreason ?? (status || "SSLCommerz didn't open a session")),
  };
}

/**
 * Checks a notice's signature: md5 over the fields named in verify_key plus md5(store password),
 * sorted by name and joined as k=v&k=v. Notices without a signature are not authentic.
 */
export function verifySign(notice: Notice, storePassword: string) {
  const sign = notice.verify_sign;
  const keys = notice.verify_key;
  if (!sign || !keys) return false;
  const data: Record<string, string> = {};
  for (const k of keys.split(",")) if (k in notice) data[k] = notice[k]!;
  data.store_passwd = md5(storePassword);
  const str = Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join("&");
  return md5(str) === sign.toLowerCase();
}

const STATUS: Record<string, ParsedNotice["status"]> = {
  VALID: "valid",
  VALIDATED: "valid",
  FAILED: "failed",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
  UNATTEMPTED: "unattempted",
};

export function parseNotice(notice: Notice, storePassword: string): ParsedNotice {
  return {
    tranId: notice.tran_id ?? "",
    valId: notice.val_id || null,
    status: STATUS[(notice.status ?? "").toUpperCase()] ?? "unknown",
    authentic: verifySign(notice, storePassword),
  };
}

/** The validation (or transaction query) answer, in our terms */
export function parseValidation(body: Record<string, unknown>): Validation {
  const s = (k: string) => (body[k] === undefined || body[k] === null ? "" : String(body[k]));
  const status = s("status").toUpperCase();
  // With currency BDT, currency_amount equals amount; prefer it when present
  const currency = s("currency_type") || s("currency");
  const amount = fromTaka(s("currency_amount") || s("amount"));
  return {
    valid: status === "VALID" || status === "VALIDATED",
    status,
    tranId: s("tran_id"),
    valId: s("val_id") || null,
    amount,
    currency,
    method: s("card_type") || null,
    bankTranId: s("bank_tran_id") || null,
    risky: s("risk_level") === "1",
    riskTitle: s("risk_title") || null,
    raw: body,
  };
}

/** Why a validation doesn't prove this payment, or null when it does */
export function mismatch(v: Validation, expected: { tranId: string; amount: number }) {
  if (!v.valid) return `the provider says ${v.status || "no such payment"}`;
  if (v.tranId !== expected.tranId) return `transaction ${v.tranId} isn't ${expected.tranId}`;
  if (v.currency !== "BDT") return `currency ${v.currency || "missing"} isn't BDT`;
  if (!Number.isFinite(v.amount) || v.amount !== expected.amount)
    return `amount ${toTaka(v.amount)} isn't ${toTaka(expected.amount)}`;
  return null;
}

const REFUND_STATUS: Record<string, RefundResult["status"]> = {
  success: "pending",
  processing: "pending",
  refunded: "completed",
  failed: "failed",
  cancelled: "failed",
};

export function parseRefund(body: Record<string, unknown>): RefundResult {
  const status = String(body.status ?? "").toLowerCase();
  const connected = String(body.APIConnect ?? "") === "DONE";
  return {
    status: connected ? (REFUND_STATUS[status] ?? "failed") : "failed",
    providerRef: body.refund_ref_id ? String(body.refund_ref_id) : null,
    error: connected
      ? body.errorReason
        ? String(body.errorReason)
        : null
      : `SSLCommerz: ${String(body.APIConnect ?? "no answer")}`,
    raw: body,
  };
}

async function getJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

/** Removes the store password from anything we keep */
const redact = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([k]) => k !== "store_passwd"));

export function sslcommerz(cfg: SslConfig): PaymentProvider {
  const base = sslBase(cfg.live);
  const auth = `store_id=${encodeURIComponent(cfg.storeId)}&store_passwd=${encodeURIComponent(cfg.storePassword)}`;
  return {
    name: "sslcommerz",
    mode: cfg.live ? "live" : "sandbox",

    async createSession(input) {
      const res = await fetch(`${base}/gwprocess/v4/api.php`, {
        method: "POST",
        body: new URLSearchParams(sessionForm(cfg, input)),
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const parsed = parseSession(body);
      if (!parsed.ok) throw new Error(parsed.error);
      return { url: parsed.url, raw: redact(body) };
    },

    handleIpn(notice) {
      return parseNotice(notice, cfg.storePassword);
    },

    async validate(valId) {
      const body = await getJson(
        `${base}/validator/api/validationserverAPI.php?val_id=${encodeURIComponent(valId)}&${auth}&v=1&format=json`,
      );
      return parseValidation(body);
    },

    async getTransaction(tranId) {
      const body = await getJson(
        `${base}/validator/api/merchantTransIDvalidationAPI.php?tran_id=${encodeURIComponent(tranId)}&${auth}&format=json`,
      );
      const list = Array.isArray(body.element) ? (body.element as Record<string, unknown>[]) : [];
      if (!list.length) return null;
      // Prefer a successful record if there is one
      const best =
        list.find((e) => ["VALID", "VALIDATED"].includes(String(e.status).toUpperCase())) ??
        list[0]!;
      return parseValidation(best);
    },

    async refund({ bankTranId, amount, reason, refundKey }) {
      if (!bankTranId)
        return {
          status: "failed",
          providerRef: null,
          error: "No bank transaction ID",
          raw: null,
        };
      const q = new URLSearchParams({
        bank_tran_id: bankTranId,
        refund_amount: toTaka(amount),
        refund_remarks: reason.slice(0, 250),
        refe_id: refundKey,
        v: "1",
        format: "json",
      });
      const body = await getJson(
        `${base}/validator/api/merchantTransIDvalidationAPI.php?${q}&${auth}`,
      );
      return parseRefund(body);
    },

    async refundStatus(providerRef) {
      const body = await getJson(
        `${base}/validator/api/merchantTransIDvalidationAPI.php?refund_ref_id=${encodeURIComponent(providerRef)}&${auth}&format=json`,
      );
      return parseRefund({ ...body, refund_ref_id: body.refund_ref_id ?? providerRef });
    },
  };
}

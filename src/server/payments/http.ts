import type { Notice, ProviderName } from "./types";

/** A provider's posted fields (form-encoded, multipart or JSON), as plain strings */
export async function readNotice(req: Request): Promise<Notice> {
  const type = req.headers.get("content-type") ?? "";
  const out: Notice = {};
  try {
    if (type.includes("application/json")) {
      const body = (await req.json()) as Record<string, unknown>;
      for (const [k, v] of Object.entries(body ?? {}))
        if (typeof v === "string" || typeof v === "number") out[k] = String(v);
    } else {
      const form = await req.formData();
      for (const [k, v] of form.entries()) if (typeof v === "string") out[k] = v;
    }
  } catch {
    /* an empty or malformed body is an empty notice */
  }
  return out;
}

/** The provider names that have callback endpoints */
export const isProviderName = (p: string): p is ProviderName =>
  p === "mock" || p === "sslcommerz" || p === "aamarpay";

/**
 * The notice with what our own callback address carries: the transaction ID and the outcome. Some
 * gateways send nothing back to some addresses (aamarPay's cancel), so the payment can still be
 * matched; the provider's own check still decides what happened.
 */
export function withCallbackParams(notice: Notice, url: string): Notice {
  const q = new URL(url).searchParams;
  const out = { ...notice };
  const tran = q.get("tran");
  const outcome = q.get("outcome");
  if (tran) out._tran = tran.slice(0, 80);
  if (outcome) out._outcome = outcome.slice(0, 20);
  return out;
}

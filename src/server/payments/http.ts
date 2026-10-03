import type { Notice } from "./types";

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
export const isProviderName = (p: string): p is "mock" | "sslcommerz" =>
  p === "mock" || p === "sslcommerz";

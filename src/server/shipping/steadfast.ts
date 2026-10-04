import { safeEqual } from "@/server/secret";
import { mapSteadfast } from "./status-steadfast";
import { trackingUrl } from "./tracking";
import type { CourierProvider, CreatedShipment, ShipmentInput } from "./types";

/**
 * Steadfast Courier, following its API (portal.packzy.com/api/v1, headers Api-Key and Secret-Key):
 *  - order:   POST create_order               → consignment_id, tracking_code, status
 *  - status:  GET  status_by_cid/{id}          → delivery_status
 *  - balance: GET  get_balance                  → current_balance (the connection test)
 *  - webhook: POST to us, "Authorization: Bearer <the token we set in Steadfast's panel>"
 * Steadfast has no cancel endpoint: a parcel is cancelled from its portal.
 */

export type SteadfastConfig = { apiKey: string; secretKey: string; webhookToken: string | null };

export const STEADFAST_BASE = "https://portal.packzy.com/api/v1";

export function steadfastOrderBody(s: ShipmentInput) {
  return {
    invoice: s.reference,
    recipient_name: s.recipient.name.slice(0, 100),
    recipient_phone: s.recipient.phone,
    recipient_address: `${s.recipient.address}, ${s.recipient.area}, ${s.recipient.district}`.slice(
      0,
      250,
    ),
    cod_amount: Math.round(s.codAmount / 100),
    note: s.note ?? "Fragile: perfume in glass. Please handle with care.",
    item_description: s.items
      .map((i) => (i.qty > 1 ? `${i.name} x${i.qty}` : i.name))
      .join(", ")
      .slice(0, 200),
    delivery_type: 0,
  };
}

type Json = Record<string, unknown>;

export function parseSteadfastCreated(b: Json): CreatedShipment {
  const c = (b.consignment ?? {}) as Json;
  if (Number(b.status) !== 200 || !c.consignment_id) {
    const errors = b.errors && typeof b.errors === "object" ? Object.values(b.errors).flat() : [];
    throw new Error(
      [String(b.message ?? "Steadfast didn't create the parcel"), ...errors.map(String)].join(": "),
    );
  }
  return {
    consignmentId: String(c.consignment_id),
    trackingCode: String(c.tracking_code ?? c.consignment_id),
    status: String(c.status ?? "in_review"),
    deliveryFee: null,
    raw: b,
  };
}

export function steadfast(cfg: SteadfastConfig) {
  async function call(path: string, init: RequestInit = {}) {
    const res = await fetch(`${STEADFAST_BASE}${path}`, {
      ...init,
      headers: {
        "Api-Key": cfg.apiKey,
        "Secret-Key": cfg.secretKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const b = (await res.json().catch(() => ({}))) as Json;
    if (res.status === 401 || res.status === 403)
      throw new Error(`Steadfast refused the keys: ${String(b.message ?? res.status)}`);
    return b;
  }

  const provider: CourierProvider & { balance(): Promise<number> } = {
    name: "steadfast",
    mode: "live",

    /** Taka in the Steadfast account */
    async balance() {
      const b = await call("/get_balance");
      if (Number(b.status) !== 200)
        throw new Error(String(b.message ?? "Steadfast didn't answer the balance check"));
      return Number(b.current_balance ?? 0);
    },

    async createShipment(input) {
      return parseSteadfastCreated(
        await call("/create_order", {
          method: "POST",
          body: JSON.stringify(steadfastOrderBody(input)),
        }),
      );
    },

    async getStatus(consignmentId) {
      const b = await call(`/status_by_cid/${encodeURIComponent(consignmentId)}`);
      return b.delivery_status ? String(b.delivery_status) : null;
    },

    async cancelShipment() {
      return { ok: false, message: "Cancel it in the Steadfast portal, then here." };
    },

    handleWebhook(headers, body) {
      const auth = headers.get("authorization") ?? "";
      const tokenSent = auth.replace(/^Bearer\s+/i, "");
      if (!safeEqual(tokenSent, cfg.webhookToken)) return null;
      const b = (body ?? {}) as Json;
      if (!b.consignment_id) return null;
      const status =
        b.notification_type === "delivery_status" && b.status ? String(b.status) : null;
      return {
        consignmentId: String(b.consignment_id),
        status,
        message: b.tracking_message ? String(b.tracking_message) : null,
        eventId: `${b.consignment_id}:${String(b.notification_type ?? "")}:${status ?? ""}:${String(b.updated_at ?? "")}`,
      };
    },

    getTrackingUrl(trackingCode, phone) {
      return trackingUrl("steadfast", trackingCode, phone);
    },

    map: mapSteadfast,
  };
  return provider;
}

export type SteadfastProvider = ReturnType<typeof steadfast>;

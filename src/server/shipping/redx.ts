import { safeEqual } from "@/server/secret";
import { parcelWeight } from "./pathao";
import { mapRedx, normaliseRedx } from "./status-redx";
import { trackingUrl } from "./tracking";
import type { CourierProvider, CreatedShipment, ShipmentInput } from "./types";

/**
 * RedX, following its open API (v1.0.0-beta), header "API-ACCESS-TOKEN: Bearer <token>":
 *  - areas:   GET  areas?district_name=…        → { areas: [{ id, name, post_code, … }] }
 *  - stores:  GET  pickup/stores                → { pickup_stores: [{ id, name, address, … }] }
 *  - parcel:  POST parcel                        → { tracking_id }
 *  - status:  GET  parcel/info/{tracking_id}     → { parcel: { status, … } }
 *  - cancel:  PATCH parcels (entity_type parcel-tracking-id, new status "cancelled")
 *  - webhook: POST to the callback address we give RedX: tracking_number, status, timestamp,
 *             message_en, invoice_number. RedX doesn't sign it, so the address carries our token.
 * Sandbox: sandbox.redx.com.bd. Live: openapi.redx.com.bd.
 */

export type RedxConfig = {
  accessToken: string;
  pickupStoreId: string;
  live: boolean;
  webhookToken: string | null;
};

export const redxBase = (live: boolean) =>
  live ? "https://openapi.redx.com.bd/v1.0.0-beta" : "https://sandbox.redx.com.bd/v1.0.0-beta";

export type RedxPlace = { id: number; name: string };
export type RedxStore = { id: number; name: string; address: string };

/** The parcel body RedX expects. Money is whole taka, as text; weight is grams. */
export function redxParcelBody(cfg: Pick<RedxConfig, "pickupStoreId">, s: ShipmentInput) {
  if (!s.redx) throw new Error("Choose the RedX delivery area first");
  const bottles = s.items.reduce((n, i) => n + i.qty, 0);
  return {
    customer_name: s.recipient.name.slice(0, 100),
    customer_phone: s.recipient.phone,
    delivery_area: s.redx.areaName,
    delivery_area_id: s.redx.areaId,
    customer_address: `${s.recipient.address}, ${s.recipient.area}, ${s.recipient.district}`.slice(
      0,
      250,
    ),
    merchant_invoice_id: s.reference,
    cash_collection_amount: String(Math.round(s.codAmount / 100)),
    parcel_weight: Math.round(parcelWeight(bottles) * 1000),
    instruction: s.note ?? "Fragile: perfume in glass. Please handle with care.",
    value: String(Math.round(s.declaredValue / 100)),
    is_closed_box: true,
    pickup_store_id: Number(cfg.pickupStoreId),
    parcel_details_json: s.items.map((i) => ({
      name: i.qty > 1 ? `${i.name} x${i.qty}` : i.name,
      category: "Perfume",
      value: 0,
    })),
  };
}

type Json = Record<string, unknown>;

/** RedX's error answers vary: a message, a list, or validation errors per field */
export function redxError(b: Json, fallback: string) {
  const parts = [b.message, b.error, b.errors]
    .flatMap((x) => (x && typeof x === "object" ? Object.values(x).flat() : x ? [x] : []))
    .map(String);
  return parts.length ? parts.join(": ") : fallback;
}

export function parseRedxCreated(b: Json): CreatedShipment {
  if (!b.tracking_id) throw new Error(redxError(b, "RedX didn't create the parcel"));
  return {
    consignmentId: String(b.tracking_id),
    trackingCode: String(b.tracking_id),
    status: "pickup-pending",
    deliveryFee: null,
    raw: b,
  };
}

export function redx(cfg: RedxConfig) {
  const base = redxBase(cfg.live);
  async function call(path: string, init: RequestInit = {}) {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "API-ACCESS-TOKEN": `Bearer ${cfg.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const b = (await res.json().catch(() => ({}))) as Json;
    if (res.status === 401 || res.status === 403)
      throw new Error(`RedX refused the access token: ${redxError(b, String(res.status))}`);
    return b;
  }

  const provider: CourierProvider & {
    areas(district: string): Promise<RedxPlace[]>;
    stores(): Promise<RedxStore[]>;
  } = {
    name: "redx",
    mode: cfg.live ? "live" : "sandbox",

    async areas(district) {
      const b = await call(`/areas?district_name=${encodeURIComponent(district)}`);
      const list = Array.isArray(b.areas) ? (b.areas as Json[]) : [];
      return list.map((a) => ({ id: Number(a.id), name: String(a.name) }));
    },

    async stores() {
      const b = await call("/pickup/stores");
      const list = Array.isArray(b.pickup_stores) ? (b.pickup_stores as Json[]) : [];
      return list.map((s) => ({
        id: Number(s.id),
        name: String(s.name ?? `Store ${s.id}`),
        address: String(s.address ?? ""),
      }));
    },

    async createShipment(input) {
      return parseRedxCreated(
        await call("/parcel", { method: "POST", body: JSON.stringify(redxParcelBody(cfg, input)) }),
      );
    },

    async getStatus(consignmentId) {
      const b = await call(`/parcel/info/${encodeURIComponent(consignmentId)}`);
      const p = (b.parcel ?? {}) as Json;
      return p.status ? normaliseRedx(String(p.status)) : null;
    },

    async cancelShipment(consignmentId) {
      const b = await call("/parcels", {
        method: "PATCH",
        body: JSON.stringify({
          entity_type: "parcel-tracking-id",
          entity_id: consignmentId,
          update_details: {
            property_name: "status",
            new_value: "cancelled",
            reason: "Cancelled by ZALFI before pickup",
          },
        }),
      });
      const ok = b.success === true || String(b.success) === "true";
      return { ok, message: ok ? "Cancelled with RedX." : redxError(b, "RedX didn't cancel it") };
    },

    handleWebhook(_headers, body, url) {
      if (!safeEqual(url?.searchParams.get("token"), cfg.webhookToken)) return null;
      const b = (body ?? {}) as Json;
      if (!b.tracking_number) return null;
      const status = b.status ? normaliseRedx(String(b.status)) : null;
      return {
        consignmentId: String(b.tracking_number),
        status,
        message: b.message_en ? String(b.message_en) : null,
        eventId: `${b.tracking_number}:${status ?? ""}:${String(b.timestamp ?? "")}`,
      };
    },

    getTrackingUrl(trackingCode, phone) {
      return trackingUrl("redx", trackingCode, phone);
    },

    map: mapRedx,
  };
  return provider;
}

export type RedxProvider = ReturnType<typeof redx>;

import { safeEqual } from "@/server/secret";
import { parcelWeight } from "./pathao";
import { mapCarrybee, normaliseCarrybee } from "./status-carrybee";
import { trackingUrl } from "./tracking";
import type { CourierProvider, CreatedShipment, ShipmentInput } from "./types";

/**
 * CarryBee, following its Delivery API (v2). Every request carries three headers, issued per
 * business and per environment on CarryBee's API Credentials page: Client-ID, Client-Secret and
 * Client-Context.
 *  - places:  GET  /api/v2/cities, /cities/{id}/zones; POST /api/v2/address-details
 *  - stores:  GET  /api/v2/stores
 *  - parcel:  POST /api/v2/orders                         → data.order.consignment_id
 *  - status:  GET  /api/v2/orders/{id}/details            → data.transfer_status
 *  - cancel:  POST /api/v2/orders/{id}/cancel             (cancellation_reason) → 202
 *  - webhook: CarryBee posts every status change as an event ("order.picked", …) with the secret
 *             from its Webhook Integration page in X-CB-Webhook-Integration-Header. The answer
 *             must be 202 with that header echoed (the route does this).
 * Sandbox: sandbox.carrybee.com. Live: developers.carrybee.com. See docs/reference/carrybee-api.md.
 */

export type CarrybeeConfig = {
  clientId: string;
  clientSecret: string;
  clientContext: string;
  storeId: string;
  live: boolean;
  webhookSecret: string | null;
};

export const carrybeeBase = (live: boolean) =>
  live ? "https://developers.carrybee.com" : "https://sandbox.carrybee.com";

export const CARRYBEE_WEBHOOK_HEADER = "X-CB-Webhook-Integration-Header";

export type CarrybeePlace = { id: number; name: string };
export type CarrybeeStore = { id: string; name: string; address: string };

const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s);

/** The order body CarryBee expects. Money is whole taka; weight is grams (1–25,000). */
export function carrybeeOrderBody(cfg: Pick<CarrybeeConfig, "storeId">, s: ShipmentInput) {
  if (!s.carrybee) throw new Error("Choose the CarryBee city and zone first");
  const bottles = s.items.reduce((n, i) => n + i.qty, 0);
  const grams = Math.round(parcelWeight(bottles) * 1000);
  return {
    store_id: cfg.storeId,
    merchant_order_id: clip(s.reference, 49),
    delivery_type: 1,
    product_type: 1,
    recipient_phone: s.recipient.phone,
    recipient_name: clip(s.recipient.name, 99),
    recipient_address: clip(
      `${s.recipient.address}, ${s.recipient.area}, ${s.recipient.district}`,
      200,
    ),
    city_id: s.carrybee.cityId,
    zone_id: s.carrybee.zoneId,
    special_instruction: clip(s.note ?? "Fragile: perfume in glass. Please handle with care.", 254),
    product_description: clip(
      s.items.map((i) => (i.qty > 1 ? `${i.name} x${i.qty}` : i.name)).join(", "),
      254,
    ),
    item_weight: Math.min(25_000, Math.max(1, grams)),
    item_quantity: Math.min(200, Math.max(1, bottles)),
    collectable_amount: Math.round(s.codAmount / 100),
    is_closed_box: true,
  };
}

type Json = Record<string, unknown>;

/**
 * CarryBee's errors share one shape, { error: true, message }; a validation error (422) adds
 * `causes`, a list of failed rules per field.
 */
export function carrybeeError(b: Json, fallback: string) {
  const message = b.message ? String(b.message) : fallback;
  const causes = b.causes && typeof b.causes === "object" ? (b.causes as Json) : null;
  if (!causes) return message;
  const parts = Object.entries(causes).map(([field, list]) => {
    const types = Array.isArray(list)
      ? list.map((c) => String((c as Json)?.type ?? "")).filter(Boolean)
      : [];
    return types.length ? `${field} (${types.join(", ")})` : field;
  });
  return parts.length ? `${message}: ${parts.join("; ")}` : message;
}

const taka = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function parseCarrybeeCreated(b: Json): CreatedShipment {
  const order = ((b.data as Json | undefined)?.order ?? {}) as Json;
  if (b.error === true || !order.consignment_id)
    throw new Error(carrybeeError(b, "CarryBee didn't create the parcel"));
  const fee = taka(order.delivery_fee) + taka(order.cod_fee);
  return {
    consignmentId: String(order.consignment_id),
    trackingCode: String(order.consignment_id),
    status: "created",
    deliveryFee: fee > 0 ? Math.round(fee * 100) : null,
    raw: b,
  };
}

const list = (b: Json, key: string) => {
  const v = (b.data as Json | undefined)?.[key];
  return Array.isArray(v) ? (v as Json[]) : [];
};

export function carrybee(cfg: CarrybeeConfig) {
  const base = carrybeeBase(cfg.live);
  async function call(path: string, init: RequestInit = {}) {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "Client-ID": cfg.clientId,
        "Client-Secret": cfg.clientSecret,
        "Client-Context": cfg.clientContext,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const b = (await res.json().catch(() => ({}))) as Json;
    // A refusal from CarryBee itself comes in its own shape; anything else is the way there
    if ((res.status === 401 || res.status === 403) && b.error === true)
      throw new Error(`CarryBee refused the keys: ${carrybeeError(b, String(res.status))}`);
    if (res.status >= 400 && b.error !== true)
      throw new Error(`CarryBee couldn't be reached (HTTP ${res.status}). Try again in a minute.`);
    return b;
  }
  const places = (b: Json, key: string): CarrybeePlace[] => {
    if (b.error === true) throw new Error(carrybeeError(b, "CarryBee didn't answer"));
    return list(b, key).map((p) => ({ id: Number(p.id), name: String(p.name) }));
  };

  const provider: CourierProvider & {
    cities(): Promise<CarrybeePlace[]>;
    zones(cityId: number): Promise<CarrybeePlace[]>;
    addressDetails(query: string): Promise<{ cityId: number; zoneId: number } | null>;
    stores(): Promise<CarrybeeStore[]>;
  } = {
    name: "carrybee",
    mode: cfg.live ? "live" : "sandbox",

    async cities() {
      return places(await call("/api/v2/cities"), "cities");
    },

    async zones(cityId) {
      return places(await call(`/api/v2/cities/${cityId}/zones`), "zones");
    },

    async addressDetails(query) {
      if (query.trim().length < 10) return null;
      const b = await call("/api/v2/address-details", {
        method: "POST",
        body: JSON.stringify({ query: clip(query.trim(), 200) }),
      });
      const d = (b.data ?? {}) as Json;
      const cityId = Number(d.city_id);
      const zoneId = Number(d.zone_id);
      return b.error !== true && cityId > 0 && zoneId > 0 ? { cityId, zoneId } : null;
    },

    async stores() {
      const b = await call("/api/v2/stores");
      if (b.error === true) throw new Error(carrybeeError(b, "CarryBee didn't list the stores"));
      return list(b, "stores")
        .filter((s) => s.is_active !== false)
        .map((s) => ({
          id: String(s.id),
          name: `${String(s.name ?? `Store ${s.id}`)}${s.is_approved === false ? " (not approved yet)" : ""}`,
          address: String(s.address ?? ""),
        }));
    },

    async createShipment(input) {
      return parseCarrybeeCreated(
        await call("/api/v2/orders", {
          method: "POST",
          body: JSON.stringify(carrybeeOrderBody(cfg, input)),
        }),
      );
    },

    async getStatus(consignmentId) {
      const b = await call(`/api/v2/orders/${encodeURIComponent(consignmentId)}/details`);
      const d = (b.data ?? {}) as Json;
      return b.error !== true && d.transfer_status
        ? normaliseCarrybee(String(d.transfer_status))
        : null;
    },

    async cancelShipment(consignmentId) {
      const b = await call(`/api/v2/orders/${encodeURIComponent(consignmentId)}/cancel`, {
        method: "POST",
        body: JSON.stringify({ cancellation_reason: "Cancelled by ZALFI before pickup" }),
      });
      const ok = b.error === false;
      return {
        ok,
        message: ok ? "Cancelled with CarryBee." : carrybeeError(b, "CarryBee didn't cancel it"),
      };
    },

    handleWebhook(headers, body) {
      // Authentic only with the secret from CarryBee's Webhook Integration page
      if (!safeEqual(headers.get(CARRYBEE_WEBHOOK_HEADER), cfg.webhookSecret)) return null;
      const b = (body ?? {}) as Json;
      // The set-up check (and a failed bulk order) names no parcel: authentic, nothing to apply
      if (!b.consignment_id) return { consignmentId: "", status: null, message: null, eventId: "" };
      const event = b.event ? normaliseCarrybee(String(b.event)) : null;
      const note = [b.reason, b.remarks].filter((x) => typeof x === "string" && x.trim());
      return {
        consignmentId: String(b.consignment_id),
        // "updated" changes amounts, not where the parcel is
        status: event && event !== "updated" ? event : null,
        message: note.length ? note.join(". ") : null,
        eventId: `${b.consignment_id}:${event ?? ""}:${String(b.timestamptz ?? "")}`,
      };
    },

    getTrackingUrl(trackingCode, phone) {
      return trackingUrl("carrybee", trackingCode, phone);
    },

    map: mapCarrybee,
  };
  return provider;
}

export type CarrybeeProvider = ReturnType<typeof carrybee>;

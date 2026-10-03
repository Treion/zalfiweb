import { mapPathao, normalisePathao } from "./status-pathao";
import { trackingUrl } from "./tracking";
import type { CourierProvider, CreatedShipment, ShipmentInput } from "./types";

/**
 * Pathao Courier, following its Merchant API (aladdin/api/v1):
 *  - token:    POST issue-token (client id and secret, merchant username and password)
 *  - lookups:  GET city-list, cities/{id}/zone-list, zones/{id}/area-list
 *  - order:    POST orders            → consignment_id
 *  - status:   GET orders/{id}/info   → order_status_slug
 *  - webhook:  POST to us, with the secret we set in Pathao's panel in X-PATHAO-Signature
 * Sandbox: courier-api-sandbox.pathao.com. Live: api-hermes.pathao.com.
 * Pathao has no cancel endpoint: a parcel is cancelled in its merchant panel.
 */

export type PathaoConfig = {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  storeId: string;
  live: boolean;
  webhookSecret: string | null;
};

export const pathaoBase = (live: boolean) =>
  live ? "https://api-hermes.pathao.com" : "https://courier-api-sandbox.pathao.com";

/** Parcel weight in kg: 0.5 kg per bottle, boxed (Pathao takes 0.5 to 10 kg) */
export const parcelWeight = (bottles: number) =>
  Math.min(10, Math.max(0.5, Math.ceil(bottles * 0.5 * 2) / 2));

/** The order body Pathao expects. COD is whole taka. */
export function pathaoOrderBody(cfg: Pick<PathaoConfig, "storeId">, s: ShipmentInput) {
  const bottles = s.items.reduce((n, i) => n + i.qty, 0);
  return {
    store_id: Number(cfg.storeId),
    merchant_order_id: s.reference,
    recipient_name: s.recipient.name,
    recipient_phone: s.recipient.phone,
    recipient_address: `${s.recipient.address}, ${s.recipient.area}, ${s.recipient.district}`.slice(
      0,
      220,
    ),
    ...(s.pathao
      ? {
          recipient_city: s.pathao.cityId,
          recipient_zone: s.pathao.zoneId,
          ...(s.pathao.areaId ? { recipient_area: s.pathao.areaId } : {}),
        }
      : {}),
    delivery_type: 48,
    item_type: 2,
    special_instruction: s.note ?? "Fragile: perfume in glass. Please handle with care.",
    item_quantity: bottles,
    item_weight: String(parcelWeight(bottles)),
    amount_to_collect: Math.round(s.codAmount / 100),
    item_description: s.items
      .map((i) => (i.qty > 1 ? `${i.name} x${i.qty}` : i.name))
      .join(", ")
      .slice(0, 200),
  };
}

type Json = Record<string, unknown>;
const dataOf = (b: Json) => (b.data ?? {}) as Json;
const listOf = (b: Json) => {
  const d = dataOf(b);
  return (Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : []) as Json[];
};

export function parseCreated(b: Json): CreatedShipment {
  const d = dataOf(b);
  if (!d.consignment_id) {
    const errors = b.errors && typeof b.errors === "object" ? Object.values(b.errors).flat() : [];
    throw new Error(
      [String(b.message ?? "Pathao didn't create the parcel"), ...errors.map(String)].join(": "),
    );
  }
  const fee = Number(d.delivery_fee);
  return {
    consignmentId: String(d.consignment_id),
    // Pathao tracks by consignment ID
    trackingCode: String(d.consignment_id),
    status: String(d.order_status ?? "Pending"),
    deliveryFee: Number.isFinite(fee) ? Math.round(fee * 100) : null,
    raw: b,
  };
}

export type PathaoPlace = { id: number; name: string };

let token: { value: string; expires: number; key: string } | null = null;

export function pathao(cfg: PathaoConfig) {
  const base = `${pathaoBase(cfg.live)}/aladdin/api/v1`;
  const key = `${cfg.live}:${cfg.clientId}:${cfg.username}`;

  async function accessToken() {
    if (token && token.key === key && token.expires > Date.now() + 60_000) return token.value;
    const res = await fetch(`${base}/issue-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        grant_type: "password",
        username: cfg.username,
        password: cfg.password,
      }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    const b = (await res.json().catch(() => ({}))) as Json;
    if (!b.access_token)
      throw new Error(`Pathao sign-in failed: ${String(b.message ?? res.status)}`);
    token = {
      value: String(b.access_token),
      expires: Date.now() + Number(b.expires_in ?? 3600) * 1000,
      key,
    };
    return token.value;
  }

  async function call(path: string, init: RequestInit = {}) {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...init.headers,
      },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    return (await res.json().catch(() => ({}))) as Json;
  }

  const places = (b: Json, id: string, name: string): PathaoPlace[] =>
    listOf(b).map((x) => ({ id: Number(x[id]), name: String(x[name]) }));

  const provider: CourierProvider & {
    cities(): Promise<PathaoPlace[]>;
    zones(cityId: number): Promise<PathaoPlace[]>;
    areas(zoneId: number): Promise<PathaoPlace[]>;
  } = {
    name: "pathao",
    mode: cfg.live ? "live" : "sandbox",

    async cities() {
      return places(await call("/city-list"), "city_id", "city_name");
    },
    async zones(cityId) {
      return places(await call(`/cities/${cityId}/zone-list`), "zone_id", "zone_name");
    },
    async areas(zoneId) {
      return places(await call(`/zones/${zoneId}/area-list`), "area_id", "area_name");
    },

    async createShipment(input) {
      const b = await call("/orders", {
        method: "POST",
        body: JSON.stringify(pathaoOrderBody(cfg, input)),
      });
      return parseCreated(b);
    },

    async getStatus(consignmentId) {
      const d = dataOf(await call(`/orders/${encodeURIComponent(consignmentId)}/info`));
      const slug = d.order_status_slug ?? d.order_status;
      return slug ? String(slug) : null;
    },

    async cancelShipment() {
      return { ok: false, message: "Cancel it in the Pathao merchant panel, then here." };
    },

    handleWebhook(headers, body) {
      // Authentic only with the secret we set in Pathao's webhook settings
      if (!cfg.webhookSecret || headers.get("x-pathao-signature") !== cfg.webhookSecret)
        return null;
      const b = (body ?? {}) as Json;
      const event = b.event ? String(b.event) : null;
      // Pathao's set-up check ("webhook_integration") names no parcel: authentic, nothing to apply
      if (!b.consignment_id)
        return event ? { consignmentId: "", status: null, message: null, eventId: "" } : null;
      return {
        consignmentId: String(b.consignment_id),
        status: event ? normalisePathao(event) : null,
        message: null,
        eventId: `${b.consignment_id}:${event ?? ""}:${String(b.updated_at ?? b.timestamp ?? "")}`,
      };
    },

    getTrackingUrl(consignmentId, phone) {
      return trackingUrl("pathao", consignmentId, phone);
    },

    map: mapPathao,
  };
  return provider;
}

export type PathaoProvider = ReturnType<typeof pathao>;

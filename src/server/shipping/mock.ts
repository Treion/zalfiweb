import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { appSecret } from "@/server/secret";
import { MOCK_STATUSES, mapMock, type MockStatus } from "./status-mock";
import type { CourierProvider } from "./types";

/**
 * The test courier (development and previews). It accepts every parcel at once; the admin then
 * plays the courier, sending status updates from the order page. Each update is a signed webhook
 * through the same code the real couriers' webhooks use. Off on the live site (see couriers.ts).
 */
const sign = (s: string) =>
  createHmac("sha256", appSecret()).update(`mock-courier:${s}`).digest("hex");

export function mockWebhook(consignmentId: string, status: MockStatus) {
  const at = new Date().toISOString();
  return {
    consignment_id: consignmentId,
    status,
    at,
    sig: sign(`${consignmentId}:${status}:${at}`),
  };
}

export const MOCK_STEPS = Object.keys(MOCK_STATUSES) as MockStatus[];

const tail = () => randomBytes(4).toString("hex").toUpperCase();

export const mockCourier: CourierProvider = {
  name: "mock",
  mode: "test",

  async createShipment(input) {
    return {
      consignmentId: `MOCK-${tail()}`,
      trackingCode: `MK${tail()}`,
      status: "awaiting_pickup",
      deliveryFee: input.recipient.district === "Dhaka" ? 6_000 : 11_000,
      raw: { mock: true, reference: input.reference },
    };
  },

  async getStatus() {
    // The test courier keeps no records: only its webhooks say what happened
    return null;
  },

  async cancelShipment() {
    return { ok: true, message: "Cancelled with the test courier." };
  },

  handleWebhook(_headers, body) {
    const b = (body ?? {}) as Record<string, string>;
    if (!b.consignment_id || !b.status || !b.sig || !(b.status in MOCK_STATUSES)) return null;
    const expected = sign(`${b.consignment_id}:${b.status}:${b.at ?? ""}`);
    const x = Buffer.from(b.sig);
    const y = Buffer.from(expected);
    if (x.length !== y.length || !timingSafeEqual(x, y)) return null;
    return {
      consignmentId: b.consignment_id,
      status: b.status,
      message: null,
      eventId: `${b.consignment_id}:${b.status}:${b.at ?? ""}`,
    };
  },

  getTrackingUrl() {
    return null;
  },

  map: mapMock,
};

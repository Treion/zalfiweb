import { randomBytes } from "node:crypto";
import { MOCK_STATUSES, mapMock, type MockStatus } from "./status-mock";
import type { CourierProvider } from "./types";

/**
 * Any other courier (Sundarban, Paperfly, eCourier…), or the team's own rider: for when the
 * connected couriers are down, or a parcel goes another way. The team types the courier's name,
 * its tracking number and link; then moves the parcel along by hand from the order page, through
 * the same status code the real couriers' updates use. The customer's tracking button opens the
 * link the team saved.
 */

/** The steps the team can record, with the test courier's plain words */
export const MANUAL_STATUSES = MOCK_STATUSES;
export type ManualStatus = MockStatus;
export const MANUAL_STEPS = Object.keys(MANUAL_STATUSES) as ManualStatus[];

/** Couriers offered by name in the send dialog (anything else can be typed) */
export const OTHER_COURIERS = [
  "Own rider",
  "Sundarban Courier",
  "SA Paribahan",
  "Paperfly",
  "eCourier",
  "Delivery Tiger",
  "Janani Express",
];

export const manualCourier: CourierProvider = {
  name: "manual",
  mode: "live",

  async createShipment(input) {
    const m = input.manual;
    if (!m?.courierName.trim()) throw new Error("Say which courier (or rider) takes it");
    const code = m.trackingCode?.trim() || `MAN-${randomBytes(3).toString("hex").toUpperCase()}`;
    return {
      consignmentId: code,
      trackingCode: code,
      status: "awaiting_pickup",
      deliveryFee: null,
      raw: { courierName: m.courierName.trim(), trackingUrl: m.trackingUrl?.trim() || null },
    };
  },

  // Nobody to ask: only the team's updates move it
  async getStatus() {
    return null;
  },

  async cancelShipment() {
    return { ok: true, message: "Taken back." };
  },

  handleWebhook() {
    return null;
  },

  getTrackingUrl() {
    // The link lives with the shipment (see tracking-query.ts)
    return null;
  },

  map: mapMock,
};

import type { OrderStatus } from "@/server/orders/state";

/**
 * Couriers, behind one interface:
 *  - pathao: Pathao Courier's merchant API (sandbox or live).
 *  - steadfast: Steadfast Courier's API (live only).
 *  - redx: RedX's open API (sandbox or live).
 *  - carrybee: CarryBee's Delivery API v2 (sandbox or live).
 *  - manual: any other courier, or the team's own rider. The team records the tracking number and
 *    moves the parcel along by hand, through the same status code the real couriers use.
 *  - mock: a test courier for development and previews. The admin plays the courier.
 * Each courier's own statuses map to ZALFI's order states in one file per courier (status-*.ts).
 * Set-up and the on/off switch for each live in Admin → Integrations.
 */

/** Every courier, in the order the admin lists them */
export const COURIER_NAMES = ["pathao", "steadfast", "redx", "carrybee", "manual", "mock"] as const;
export type CourierName = (typeof COURIER_NAMES)[number];

/** "Other courier": names offered in the send dialog (anything else can be typed) */
export const OTHER_COURIERS = [
  "Own rider",
  "Sundarban Courier",
  "SA Paribahan",
  "Paperfly",
  "eCourier",
  "Delivery Tiger",
  "Janani Express",
];

/** The status of a parcel taken back from the admin before pickup (not a courier's own word) */
export const CANCELLED_HERE = "cancelled_by_zalfi";

export const COURIER_LABELS: Record<CourierName, string> = {
  pathao: "Pathao",
  steadfast: "Steadfast",
  redx: "RedX",
  carrybee: "CarryBee",
  manual: "Other courier",
  mock: "Test courier",
};

/** What a courier needs to collect a parcel and deliver it */
export type ShipmentInput = {
  /** Our reference: the order number (a suffix when the order is sent again) */
  reference: string;
  recipient: { name: string; phone: string; address: string; district: string; area: string };
  /** Poisha. Zero for an order already paid online. */
  codAmount: number;
  items: { name: string; qty: number }[];
  /** What the parcel is worth (poisha): the order total. Some couriers ask, for insurance. */
  declaredValue: number;
  /** Pathao only: the city and zone chosen (or matched) for the address */
  pathao?: { cityId: number; zoneId: number; areaId?: number | null };
  /** RedX only: the delivery area chosen (or matched) for the address */
  redx?: { areaId: number; areaName: string };
  /** CarryBee only: the city and zone chosen (or matched) for the address */
  carrybee?: { cityId: number; zoneId: number };
  /** Another courier, or the team's own rider: what the team typed in */
  manual?: { courierName: string; trackingCode: string | null; trackingUrl: string | null };
  note?: string;
};

export type CreatedShipment = {
  consignmentId: string;
  trackingCode: string;
  /** The courier's own status for the new parcel */
  status: string;
  /** Poisha, when the courier quotes it */
  deliveryFee: number | null;
  raw: unknown;
};

/** A courier's status, in ZALFI's terms (see status-*.ts) */
export type MappedStatus = {
  /** Plain words for the admin and the timeline */
  label: string;
  /** The order state this status means, or null when it changes nothing */
  order: OrderStatus | null;
  /** The parcel's journey is over (delivered, returned or cancelled): stop polling */
  final: boolean;
  /** Something the team should look at */
  attention?: string;
  /** A failed delivery attempt */
  failedAttempt?: boolean;
};

/** A webhook, read: whose parcel, and what the courier says happened */
export type CourierEvent = {
  consignmentId: string;
  status: string | null;
  message: string | null;
  /** For de-duplication */
  eventId: string;
};

export interface CourierProvider {
  readonly name: CourierName;
  readonly mode: "test" | "sandbox" | "live";
  createShipment(input: ShipmentInput): Promise<CreatedShipment>;
  /** The courier's current status for a parcel, or null when it can't say */
  getStatus(consignmentId: string, trackingCode: string | null): Promise<string | null>;
  cancelShipment(consignmentId: string): Promise<{ ok: boolean; message: string }>;
  /**
   * Checks a webhook's authenticity and reads it. Null when it isn't authentic or isn't ours.
   * `url` is the address it was posted to (RedX proves itself with a token in it).
   */
  handleWebhook(headers: Headers, body: unknown, url?: URL): CourierEvent | null;
  /** A public tracking page for the customer, or null */
  getTrackingUrl(trackingCode: string, phone: string): string | null;
  map(status: string): MappedStatus;
}

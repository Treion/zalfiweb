/**
 * What a shopper needs before buying, as Settings say it: delivery fees and times, free delivery,
 * and how they can pay. Read on the server (server/checkout/terms.ts), shown by <DeliveryNote />
 * and the bag. Nothing here is invented: every line follows a setting.
 */
export type ShopTerms = {
  insideFee: number;
  outsideFee: number;
  /** "1–2" (days), or "" to say nothing about time */
  insideDays: string;
  outsideDays: string;
  /** Orders from this subtotal (after discounts) ship free; null: never */
  freeFrom: number | null;
  /** Cards, bKash and Nagad through a gateway */
  online: boolean;
  cod: boolean;
  /** Wallets that take Send Money by hand: "bKash", "Nagad" */
  wallets: string[];
};

/** The payment marks, in the order shoppers look for them */
export function paymentMarks(t: Pick<ShopTerms, "online" | "cod" | "wallets">) {
  const marks = new Set<string>();
  if (t.online) ["Cards", "bKash", "Nagad"].forEach((m) => marks.add(m));
  t.wallets.forEach((w) => marks.add(w));
  if (t.cod) marks.add("Cash on delivery");
  return [...marks];
}

/** "usually 1–2 days", or "" when the shop doesn't say */
export const usually = (days: string) =>
  days ? `usually ${days} ${/^1$/.test(days) ? "day" : "days"}` : "";

/** How far a bag is from free delivery (0 once it's there); null when there's no free delivery */
export const toFreeDelivery = (subtotal: number, freeFrom: number | null) =>
  freeFrom === null ? null : Math.max(0, freeFrom - subtotal);

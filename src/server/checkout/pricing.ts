import { formatPrice } from "@/lib/money";

/**
 * The money rules of checkout: shipping zone and fee, coupon discounts, and the order total. Pure
 * functions (no database), so every rule is unit-tested and the quote and the placed order can
 * never disagree. All amounts are integer poisha.
 */

export type Zone = "inside_dhaka" | "outside_dhaka";

export type ShippingRules = {
  insideDhakaFee: number;
  outsideDhakaFee: number;
  insideDhakaAreas: string[];
  freeShippingThreshold: number | null;
};

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Inside Dhaka: Dhaka district, and an area on the editable list (Settings → Shipping) */
export function shippingZone(district: string, area: string, rules: ShippingRules): Zone {
  return district === "Dhaka" && rules.insideDhakaAreas.some((a) => same(a, area))
    ? "inside_dhaka"
    : "outside_dhaka";
}

/**
 * The fee for a zone. Free when a coupon gives free shipping, or when what the customer pays for
 * the bottles (after any discount) reaches the free-shipping threshold.
 */
export function shippingFee(
  zone: Zone,
  goodsTotal: number,
  rules: ShippingRules,
  freeShippingCoupon = false,
): number {
  if (freeShippingCoupon) return 0;
  if (rules.freeShippingThreshold !== null && goodsTotal >= rules.freeShippingThreshold) return 0;
  return zone === "inside_dhaka" ? rules.insideDhakaFee : rules.outsideDhakaFee;
}

/* ---------------------------------------------------------------------------------------------- */
/* Coupons                                                                                         */

export type CouponRules = {
  code: string;
  active: boolean;
  percentOff: number | null;
  maxDiscount: number | null;
  amountOff: number | null;
  freeShipping: boolean;
  minSubtotal: number | null;
  firstOrderOnly: boolean;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  fragranceIds: number[];
  variantIds: number[];
};

export type PricedLine = {
  variantId: number;
  /** Null for a discovery set: a coupon for a fragrance doesn't reach the sets that hold it */
  fragranceId: number | null;
  lineTotal: number;
};

export type CouponContext = {
  lines: PricedLine[];
  subtotal: number;
  now: Date;
  /** Orders that used the coupon (cancelled ones don't count) */
  timesUsed: number;
  /** The verified phone, or null when the customer hasn't verified one yet */
  phone: string | null;
  /** Orders this phone has already used the coupon on */
  usedByPhone: number;
  /** Earlier orders from this phone (cancelled ones don't count) */
  ordersByPhone: number;
};

export type CouponResult =
  { ok: true; discount: number; freeShipping: boolean } | { ok: false; message: string };

/** Discounts are whole taka, rounded down, so cash on delivery never needs poisha */
const wholeTaka = (poisha: number) => Math.floor(poisha / 100) * 100;

/** Whether a coupon applies, and what it takes off. One coupon per order. */
export function evaluateCoupon(c: CouponRules, ctx: CouponContext): CouponResult {
  const no = (message: string): CouponResult => ({ ok: false, message });
  if (!c.active) return no("That code isn't active.");
  if (c.startsAt && ctx.now < c.startsAt) return no("That code isn't open yet.");
  if (c.endsAt && ctx.now >= c.endsAt) return no("That code has expired.");
  if (c.usageLimit !== null && ctx.timesUsed >= c.usageLimit)
    return no("That code has been fully used.");
  if (c.firstOrderOnly || c.perCustomerLimit !== null) {
    if (!ctx.phone) return no("Verify your phone number to use that code.");
    if (c.firstOrderOnly && ctx.ordersByPhone > 0) return no("That code is for a first order.");
    if (c.perCustomerLimit !== null && ctx.usedByPhone >= c.perCustomerLimit)
      return no("You've already used that code.");
  }
  if (c.minSubtotal !== null && ctx.subtotal < c.minSubtotal)
    return no(`That code starts from ${formatPrice(c.minSubtotal)}.`);

  const restricted = c.fragranceIds.length > 0 || c.variantIds.length > 0;
  const eligible = restricted
    ? ctx.lines.filter(
        (l) =>
          (l.fragranceId !== null && c.fragranceIds.includes(l.fragranceId)) ||
          c.variantIds.includes(l.variantId),
      )
    : ctx.lines;
  if (!eligible.length) return no("That code doesn't apply to these bottles.");
  const base = eligible.reduce((s, l) => s + l.lineTotal, 0);

  let discount = 0;
  if (c.percentOff !== null) {
    discount = (base * c.percentOff) / 100;
    if (c.maxDiscount !== null) discount = Math.min(discount, c.maxDiscount);
  }
  if (c.amountOff !== null) discount += c.amountOff;
  discount = Math.min(wholeTaka(discount), base);
  return { ok: true, discount, freeShipping: c.freeShipping };
}

/* ---------------------------------------------------------------------------------------------- */
/* Totals                                                                                          */

export type Totals = {
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
};

export function totals(
  subtotal: number,
  discount: number,
  zone: Zone | null,
  rules: ShippingRules,
  freeShippingCoupon: boolean,
): Totals {
  const d = Math.max(0, Math.min(discount, subtotal));
  const fee = zone ? shippingFee(zone, subtotal - d, rules, freeShippingCoupon) : 0;
  return { subtotal, discount: d, shippingFee: fee, total: subtotal - d + fee };
}

/**
 * Prices include VAT. When VAT is on (Settings → Invoice), receipts show the VAT the total already
 * contains: total × rate / (100 + rate), rounded to the poisha.
 */
export const includedVat = (total: number, ratePercent: number) =>
  ratePercent > 0 ? Math.round((total * ratePercent) / (100 + ratePercent)) : 0;

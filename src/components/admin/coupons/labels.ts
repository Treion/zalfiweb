import { formatPrice } from "@/lib/money";
import type { CouponListRow, CouponState } from "@/server/coupons";

export const COUPON_STATES: Record<
  CouponState,
  { label: string; tone: "success" | "info" | "neutral" | "warning" }
> = {
  active: { label: "Active", tone: "success" },
  scheduled: { label: "Scheduled", tone: "info" },
  expired: { label: "Expired", tone: "neutral" },
  used_up: { label: "Used up", tone: "warning" },
  off: { label: "Off", tone: "neutral" },
};

/** "15% off (up to ৳500) + free shipping" */
export function describeCoupon(
  c: Pick<CouponListRow, "percentOff" | "maxDiscount" | "amountOff" | "freeShipping">,
) {
  const parts: string[] = [];
  if (c.percentOff !== null)
    parts.push(
      `${c.percentOff}% off${c.maxDiscount !== null ? ` (up to ${formatPrice(c.maxDiscount)})` : ""}`,
    );
  if (c.amountOff !== null) parts.push(`${formatPrice(c.amountOff)} off`);
  if (c.freeShipping) parts.push("free shipping");
  const s = parts.join(" + ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { orders } from "@/db/schema";
import { phoneSchema } from "@/lib/checkout";
import { poolDb, type Executor } from "@/server/db/pool";
import { confirmationUrl } from "@/server/payments/service";

/**
 * "Track your order": the order number and the phone it was placed with open the order's own page
 * (the same one the receipt links to). Both must match; a miss never says which part was wrong.
 */
export const trackSchema = z
  .object({ number: z.string().trim().min(1).max(24), phone: phoneSchema })
  .strict();

/** "ZLF-001234", "zlf 1234" or "1234" → "ZLF-001234"; null when it can't be an order number */
export function orderNumberOf(raw: string) {
  const digits = raw.replace(/^\s*zlf/i, "").replace(/\D/g, "");
  if (!digits || digits.length > 6 || /[a-z]/i.test(raw.replace(/^\s*zlf/i, ""))) return null;
  return `ZLF-${digits.padStart(6, "0")}`;
}

/** The order page's address for this number and phone, or null */
export async function findOrderPage(rawNumber: string, phone: string, exec: Executor = poolDb()) {
  const number = orderNumberOf(rawNumber);
  if (!number) return null;
  const [o] = await exec
    .select({ token: orders.accessToken })
    .from(orders)
    .where(and(eq(orders.number, number), eq(orders.customerPhone, phone)))
    .limit(1);
  return o ? confirmationUrl(o.token) : null;
}

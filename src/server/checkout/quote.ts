import { and, asc, count, eq, inArray, ne, sql } from "drizzle-orm";
import type { z } from "zod";
import { coupons, fragrances, orders, variants } from "@/db/schema";
import type { PaymentMethod, Quote, quoteSchema } from "@/lib/checkout";
import { poolDb, type Executor } from "@/server/db/pool";
import { getSettings, type Settings } from "@/server/settings";
import { availableOf, reservedBy } from "@/server/catalog/stock";
import { currentGateway } from "@/server/payments/providers";
import {
  evaluateCoupon,
  shippingZone,
  totals,
  type CouponResult,
  type PricedLine,
  type ShippingRules,
  type Zone,
} from "./pricing";

/**
 * Prices a bag from the database: current prices, what can still be sold, the coupon, the
 * shipping fee and the total. The quote the customer sees and the order that gets placed are
 * both built here, so they can never disagree.
 */

export type BagLine = PricedLine & {
  sku: string;
  name: string;
  sizeMl: number;
  unitPrice: number;
  qty: number;
  available: number;
};

/** The bag's lines at today's prices. Sizes that are hidden, switched off or gone are listed apart. */
/**
 * `lock` (placing an order): the sizes' rows are locked first, in id order, before anything else
 * in the transaction touches them. Inserting order lines takes a key-share lock on each size, and
 * two checkouts that both did that before locking for the stock change would deadlock.
 */
export async function priceBag(
  exec: Executor,
  items: { sku: string; qty: number }[],
  lock = false,
) {
  const merged = new Map<string, number>();
  for (const i of items) merged.set(i.sku, (merged.get(i.sku) ?? 0) + i.qty);
  const skus = [...merged.keys()];
  if (lock)
    await exec
      .select({ id: variants.id })
      .from(variants)
      .where(inArray(variants.sku, skus))
      .orderBy(asc(variants.id))
      .for("update");
  const rows = await exec
    .select({
      variantId: variants.id,
      fragranceId: fragrances.id,
      sku: variants.sku,
      name: fragrances.name,
      sizeMl: variants.sizeMl,
      unitPrice: variants.pricePoisha,
      stock: variants.stock,
      sortOrder: fragrances.sortOrder,
    })
    .from(variants)
    .innerJoin(fragrances, eq(fragrances.id, variants.fragranceId))
    .where(
      and(inArray(variants.sku, skus), eq(variants.active, true), eq(fragrances.published, true)),
    );
  const reserved = await reservedBy(
    exec,
    rows.map((r) => r.variantId),
  );
  const lines: BagLine[] = skus.flatMap((sku) => {
    const r = rows.find((x) => x.sku === sku);
    if (!r) return [];
    const qty = merged.get(sku)!;
    return [
      {
        variantId: r.variantId,
        fragranceId: r.fragranceId,
        sku,
        name: r.name,
        sizeMl: r.sizeMl,
        unitPrice: r.unitPrice,
        qty,
        lineTotal: r.unitPrice * qty,
        available: availableOf(r.stock, reserved.get(r.variantId) ?? 0),
      },
    ];
  });
  const unavailable = skus.filter(
    (s) => !lines.some((l) => l.sku === s) || lines.find((l) => l.sku === s)!.available <= 0,
  );
  return { lines, unavailable };
}

export type CouponRow = typeof coupons.$inferSelect;

export async function findCoupon(exec: Executor, code: string, lock = false) {
  const q = exec
    .select()
    .from(coupons)
    .where(sql`upper(${coupons.code}) = ${code.toUpperCase()}`)
    .limit(1);
  const [row] = lock ? await q.for("update") : await q;
  return row ?? null;
}

/** Usage counts come from orders (cancelled ones don't count), never from a stored counter */
async function couponUsage(exec: Executor, couponId: number, phone: string | null) {
  const live = and(eq(orders.couponId, couponId), ne(orders.status, "cancelled"));
  const [[all], [mine]] = await Promise.all([
    exec.select({ n: count() }).from(orders).where(live),
    phone
      ? exec
          .select({ n: count() })
          .from(orders)
          .where(and(live, eq(orders.customerPhone, phone)))
      : Promise.resolve([{ n: 0 }]),
  ]);
  return { timesUsed: all?.n ?? 0, usedByPhone: mine?.n ?? 0 };
}

async function ordersByPhone(exec: Executor, phone: string | null) {
  if (!phone) return 0;
  const [r] = await exec
    .select({ n: count() })
    .from(orders)
    .where(and(eq(orders.customerPhone, phone), ne(orders.status, "cancelled")));
  return r?.n ?? 0;
}

export async function applyCoupon(
  exec: Executor,
  code: string,
  lines: BagLine[],
  subtotal: number,
  phone: string | null,
  lock = false,
): Promise<{ row: CouponRow | null; result: CouponResult }> {
  const row = await findCoupon(exec, code, lock);
  if (!row) return { row: null, result: { ok: false, message: "We don't know that code." } };
  const [usage, prior] = await Promise.all([
    couponUsage(exec, row.id, phone),
    ordersByPhone(exec, phone),
  ]);
  const result = evaluateCoupon(row, {
    lines,
    subtotal,
    now: new Date(),
    phone,
    timesUsed: usage.timesUsed,
    usedByPhone: usage.usedByPhone,
    ordersByPhone: prior,
  });
  return { row, result };
}

export const shippingRules = (s: Settings<"shipping">): ShippingRules => ({
  insideDhakaFee: s.insideDhakaFee,
  outsideDhakaFee: s.outsideDhakaFee,
  insideDhakaAreas: s.insideDhakaAreas,
  freeShippingThreshold: s.freeShippingThreshold,
});

/** What checkout offers: the methods switched on, and online payment only with a gateway ready */
export function enabledMethods(p: Settings<"payments">, onlineReady = true): PaymentMethod[] {
  const m: PaymentMethod[] = [];
  if (p.sslcommerzEnabled && onlineReady) m.push("sslcommerz");
  if (p.codEnabled) m.push("cod");
  return m;
}

export async function checkoutMethods(exec: Executor = poolDb()) {
  const [pay, gateway] = await Promise.all([getSettings("payments", exec), currentGateway(exec)]);
  return { pay, methods: enabledMethods(pay, !!gateway.provider) };
}

/** The full quote for the checkout page */
export async function quoteBag(
  input: z.output<typeof quoteSchema>,
  phone: string | null,
  exec: Executor = poolDb(),
): Promise<Quote> {
  const [{ lines, unavailable }, ship, { methods }] = await Promise.all([
    priceBag(exec, input.items),
    getSettings("shipping", exec),
    checkoutMethods(exec),
  ]);
  const rules = shippingRules(ship);
  const sellable = lines.filter((l) => l.available > 0);
  const subtotal = sellable.reduce((s, l) => s + l.lineTotal, 0);

  let coupon: Quote["coupon"] = null;
  let discount = 0;
  let freeShipping = false;
  if (input.coupon) {
    const { result } = await applyCoupon(exec, input.coupon, sellable, subtotal, phone);
    if (result.ok) {
      discount = result.discount;
      freeShipping = result.freeShipping;
      coupon = { code: input.coupon, ok: true, freeShipping };
    } else coupon = { code: input.coupon, ok: false, message: result.message };
  }

  const zone: Zone | null =
    input.district && input.area ? shippingZone(input.district, input.area, rules) : null;
  const t = totals(subtotal, discount, zone, rules, freeShipping);
  return {
    lines: lines.map(({ sku, name, sizeMl, unitPrice, qty, lineTotal, available }) => ({
      sku,
      name,
      sizeMl,
      unitPrice,
      qty,
      lineTotal,
      available,
    })),
    unavailable,
    ...t,
    zone,
    coupon,
    freeShippingFrom: rules.freeShippingThreshold,
    methods,
  };
}

import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { discoverySets, fragrances, restockRequests, variants } from "@/db/schema";
import { siteUrl } from "@/lib/env";
import { maskPhone } from "@/server/request";
import { poolDb, type Executor } from "@/server/db/pool";
import { UserFacingError } from "@/server/errors";
import { smsProvider } from "@/server/providers/sms";
import { availableOf, reservedBy } from "./stock";

/**
 * "Notify me": shoppers leave a phone for a sold-out size, and get one SMS when it's back. Asked
 * for from the product page or /discovery; sent when stock goes from none to some (adjustStock).
 */

/** What a variant is, for the message and the link back */
async function describe(exec: Executor, variantId: number) {
  const [v] = await exec
    .select({
      id: variants.id,
      stock: variants.stock,
      active: variants.active,
      fragrance: fragrances.name,
      fragranceSlug: fragrances.slug,
      set: discoverySets.name,
      setSlug: discoverySets.slug,
    })
    .from(variants)
    .leftJoin(fragrances, eq(fragrances.id, variants.fragranceId))
    .leftJoin(discoverySets, eq(discoverySets.id, variants.setId))
    .where(eq(variants.id, variantId));
  if (!v) return null;
  return {
    ...v,
    name: v.fragrance ?? v.set ?? "Your fragrance",
    href: v.fragranceSlug ? `/fragrances/${v.fragranceSlug}` : `/discovery#${v.setSlug}`,
  };
}

/** Leaves a phone for a sold-out sku. Already waiting is fine; in stock says so. */
export async function requestRestock(sku: string, phone: string, exec: Executor = poolDb()) {
  const [v] = await exec
    .select({ id: variants.id, stock: variants.stock, active: variants.active })
    .from(variants)
    .where(eq(variants.sku, sku));
  if (!v || !v.active) throw new UserFacingError("That isn't on sale any more.");
  const held = (await reservedBy(exec, [v.id])).get(v.id) ?? 0;
  if (availableOf(v.stock, held) > 0) return { status: "in_stock" as const };
  await exec.insert(restockRequests).values({ variantId: v.id, phone }).onConflictDoNothing();
  return { status: "waiting" as const };
}

/** Texts everyone waiting for this variant, once, if it's really back. Returns how many. */
export async function notifyRestocked(variantId: number, exec: Executor = poolDb()) {
  // A locking read waits for the stock change that called this to commit (or roll back), so it
  // reads the stock as it ends up, wherever the task started
  await exec
    .select({ id: variants.id })
    .from(variants)
    .where(eq(variants.id, variantId))
    .for("share");
  const v = await describe(exec, variantId);
  if (!v || !v.active || v.stock <= 0) return 0;
  const waiting = await exec
    .select({ id: restockRequests.id, phone: restockRequests.phone })
    .from(restockRequests)
    .where(and(eq(restockRequests.variantId, variantId), isNull(restockRequests.notifiedAt)));
  if (!waiting.length) return 0;
  const sms = await smsProvider(exec);
  const text = `ZALFI: ${v.name} is back. ${siteUrl()}${v.href}`;
  let sent = 0;
  for (const w of waiting) {
    const res = await sms
      .send(w.phone, text)
      .catch((e: Error) => ({ ok: false, error: e.message }));
    if (!res.ok) {
      // Left waiting: the next return of stock tries again
      console.error("[restock] couldn't text", maskPhone(w.phone), "error" in res ? res.error : "");
      continue;
    }
    sent++;
    await exec
      .update(restockRequests)
      .set({ notifiedAt: new Date() })
      .where(eq(restockRequests.id, w.id));
  }
  return sent;
}

/** How many phones wait for each variant (Inventory shows it) */
export async function waitingByVariant(ids: number[], exec: Executor = poolDb()) {
  if (!ids.length) return new Map<number, number>();
  const rows = await exec
    .select({ id: restockRequests.variantId, n: count() })
    .from(restockRequests)
    .where(and(inArray(restockRequests.variantId, ids), isNull(restockRequests.notifiedAt)))
    .groupBy(restockRequests.variantId);
  return new Map(rows.map((r) => [r.id, Number(r.n)]));
}

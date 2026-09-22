import { inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { variants } from "@/db/schema";
import { FRAGRANCES } from "@/db/seed-data";

// Checkout placeholder, shaped for Stripe Checkout Sessions.
// To go live:
//   1. npm i stripe, and set STRIPE_SECRET_KEY
//   2. Map each validated line to a Stripe price (store stripe_price_id on `variants`)
//   3. stripe.checkout.sessions.create({ mode: "payment", line_items, success_url, cancel_url })
//   4. Return { url: session.url } with status 200. The cart drawer already redirects to `url`.

const Body = z.object({
  items: z
    .array(z.object({ sku: z.string().min(1).max(64), qty: z.number().int().min(1).max(10) }))
    .min(1)
    .max(20),
});

export type CheckoutResponse =
  | { status: "ready"; url: string }
  | { status: "unavailable"; message: string; subtotalCents: number; currency: string }
  | { status: "invalid"; message: string };

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { status: "invalid", message: "Your bag looks empty." } satisfies CheckoutResponse,
      {
        status: 422,
      },
    );
  }

  const skus = parsed.data.items.map((i) => i.sku);
  const db = getDb();
  const priced = db
    ? await db
        .select({
          sku: variants.sku,
          priceCents: variants.priceCents,
          currency: variants.currency,
          stock: variants.stock,
        })
        .from(variants)
        .where(inArray(variants.sku, skus))
        .catch(() => null)
    : FRAGRANCES.flatMap((f) => f.variants).filter((v) => skus.includes(v.sku));
  if (!priced) {
    return Response.json(
      { status: "invalid", message: "We couldn't price your bag. Try again." },
      { status: 503 },
    );
  }

  const bySku = new Map(priced.map((p) => [p.sku, p]));
  for (const item of parsed.data.items) {
    const v = bySku.get(item.sku);
    if (!v)
      return Response.json(
        { status: "invalid", message: "An item is no longer available." },
        { status: 409 },
      );
    if (v.stock < item.qty) {
      return Response.json(
        { status: "invalid", message: "One of your bottles is running low. Adjust the quantity." },
        { status: 409 },
      );
    }
  }
  const subtotalCents = parsed.data.items.reduce(
    (s, i) => s + bySku.get(i.sku)!.priceCents * i.qty,
    0,
  );

  // Prices are always recomputed on the server: the client's totals are never trusted.
  return Response.json(
    {
      status: "unavailable",
      message: "Checkout opens soon. Your bag is saved on this device.",
      subtotalCents,
      currency: priced[0]?.currency ?? "USD",
    } satisfies CheckoutResponse,
    { status: 200 },
  );
}

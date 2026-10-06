import { eq } from "drizzle-orm";
import { orders } from "@/db/schema";
import { getAdmin } from "@/server/auth/session";
import { poolDb } from "@/server/db/pool";
import { renderGiftCard } from "@/server/invoice/gift-card";

export const dynamic = "force-dynamic";

/** The order's gift note as an A6 card to print and put in the box */
export async function GET(_req: Request, ctx: RouteContext<"/api/admin/orders/[id]/gift-card">) {
  const admin = await getAdmin();
  if (!admin) return new Response("Sign in", { status: 401 });
  if (!admin.can("orders.view")) return new Response("Forbidden", { status: 403 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 });
  const [o] = await poolDb()
    .select({ number: orders.number, giftMessage: orders.giftMessage })
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);
  if (!o?.giftMessage) return new Response("This order isn't a gift.", { status: 404 });
  const pdf = await renderGiftCard(o.giftMessage, o.number);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="gift-note-${o.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

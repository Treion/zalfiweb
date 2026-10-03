import { getAdmin } from "@/server/auth/session";
import { loadInvoice } from "@/server/invoice/data";
import { renderInvoicePdf } from "@/server/invoice/pdf";

export const dynamic = "force-dynamic";

/** The order's invoice as a PDF (the same document the e-receipt attaches) */
export async function GET(req: Request, ctx: RouteContext<"/api/admin/orders/[id]/invoice">) {
  const admin = await getAdmin();
  if (!admin) return new Response("Sign in", { status: 401 });
  if (!admin.can("orders.view")) return new Response("Forbidden", { status: 403 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 });
  const loaded = await loadInvoice(id);
  if (!loaded) return new Response("Not found", { status: 404 });
  const pdf = await renderInvoicePdf(loaded.data);
  const inline = new URL(req.url).searchParams.has("view");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="ZALFI-${loaded.order.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

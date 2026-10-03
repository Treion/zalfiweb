import { getAdmin } from "@/server/auth/session";
import { loadLabels, renderLabels } from "@/server/shipping/label";

export const dynamic = "force-dynamic";

/** Shipping labels as one PDF: ?ids=12,13,14 (orders with a parcel at a courier) */
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return new Response("Sign in", { status: 401 });
  if (!admin.can("shipping.manage")) return new Response("Forbidden", { status: 403 });
  const ids = (new URL(req.url).searchParams.get("ids") ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 200);
  const data = await loadLabels(ids);
  if (!data.length)
    return new Response("None of these orders has a parcel with a courier yet.", { status: 404 });
  const pdf = await renderLabels(data);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${data.length === 1 ? `label-${data[0]!.number}` : `labels-${data.length}`}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

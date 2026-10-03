import { mockAllowed } from "@/server/payments/providers";
import { firstDelivery, settleNotice } from "@/server/payments/service";
import { readNotice } from "@/server/payments/http";

// The test gateway's buttons. Like a real gateway, it first sends its notice server to server
// (the IPN code path), then sends the customer back with the same notice: a 307 re-posts the form
// to the return URL. Off on the live site.

export async function POST(req: Request) {
  if (!mockAllowed()) return new Response("Not found", { status: 404 });
  const notice = await readNotice(req);
  const eventId = `${notice.tran_id ?? ""}:${notice.status ?? ""}:${notice.val_id ?? ""}`;
  if (notice.tran_id && (await firstDelivery("mock-ipn", eventId)))
    await settleNotice("mock", notice, "ipn");
  return new Response(null, {
    status: 307,
    headers: { Location: "/api/payments/return/mock?outcome=" + (notice.status ?? "") },
  });
}

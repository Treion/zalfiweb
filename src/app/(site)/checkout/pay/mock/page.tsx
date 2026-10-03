import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { orders, payments } from "@/db/schema";
import { formatPrice } from "@/lib/money";
import { poolDb } from "@/server/db/pool";
import { mockNotice, type MockOutcome } from "@/server/payments/mock";
import { mockAllowed } from "@/server/payments/providers";
import { confirmationUrl } from "@/server/payments/service";

export const metadata: Metadata = {
  title: "Test payment",
  robots: { index: false, follow: false },
};

const OUTCOMES: { outcome: MockOutcome; label: string; primary?: boolean }[] = [
  { outcome: "success", label: "Pay successfully", primary: true },
  { outcome: "fail", label: "Fail the payment" },
  { outcome: "cancel", label: "Cancel and go back" },
];

/**
 * The test gateway (development and previews only). Stands where SSLCommerz's payment page will:
 * each button posts the signed notice a real gateway would send, through the same code paths.
 */
export default async function MockPayPage({ searchParams }: PageProps<"/checkout/pay/mock">) {
  if (!mockAllowed()) notFound();
  const { t } = await searchParams;
  if (typeof t !== "string" || t.length > 60) notFound();
  const [row] = await poolDb()
    .select({ payment: payments, number: orders.number, token: orders.accessToken })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(eq(payments.tranId, t))
    .limit(1);
  if (!row || row.payment.provider !== "mock") notFound();
  const { payment, number, token } = row;
  const open = payment.status === "initiated";

  return (
    <main id="main" className="bg-bone px-gutter text-noir min-h-svh pt-36 pb-24">
      <div className="border-noir/20 mx-auto max-w-xl border p-8 md:p-12">
        <p className="eyebrow text-smoke">Test payment gateway</p>
        <h1 className="font-display mt-6 text-5xl leading-none">{formatPrice(payment.amount)}</h1>
        <p className="text-smoke mt-3">{`Order ${number} · transaction ${payment.tranId}`}</p>
        <p className="border-noir/15 mt-8 border-t pt-6 text-sm leading-relaxed">
          This stands in for SSLCommerz while it isn&rsquo;t connected. No money moves. Each button
          sends the notice a real gateway sends, so the order is settled exactly as it will be live.
        </p>
        {open ? (
          <div className="mt-8 flex flex-col gap-3">
            {OUTCOMES.map((o) => (
              <form key={o.outcome} method="post" action="/api/payments/mock/complete">
                {Object.entries(mockNotice(payment.tranId, payment.amount, o.outcome)).map(
                  ([k, v]) => (
                    <input key={k} type="hidden" name={k} value={v} />
                  ),
                )}
                <button
                  type="submit"
                  className={`eyebrow w-full py-5 ${o.primary ? "bg-noir text-bone" : "border-noir/30 border"}`}
                >
                  {o.label}
                </button>
              </form>
            ))}
            <form method="post" action="/api/payments/mock/complete" className="mt-2 text-center">
              {Object.entries(mockNotice(payment.tranId, payment.amount, "wrong-amount")).map(
                ([k, v]) => (
                  <input key={k} type="hidden" name={k} value={v} />
                ),
              )}
              <button type="submit" className="text-smoke text-xs underline underline-offset-4">
                Pay ৳1 more than asked (tests the amount check)
              </button>
            </form>
          </div>
        ) : (
          <div className="mt-8">
            <p className="font-display text-2xl">This payment is already finished.</p>
            <Link
              href={confirmationUrl(token)}
              className="eyebrow border-noir mt-6 inline-block border-b pb-1"
            >
              Back to the order
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

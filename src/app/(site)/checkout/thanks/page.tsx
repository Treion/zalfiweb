import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PAYMENT_LABELS } from "@/lib/checkout";
import { formatPrice } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { formatDateTime } from "@/lib/time";
import { checkoutOpen } from "@/server/checkout/http";
import { orderForCustomer } from "@/server/orders/public";
import { PayNow } from "@/components/cart/PayNow";
import { ManualPay } from "@/components/cart/ManualPay";
import { latestManualPayment, manualWallets } from "@/server/payments/manual";
import { orderTracking } from "@/server/shipping/tracking-query";

export const metadata: Metadata = {
  title: "Thank you",
  robots: { index: false, follow: false },
};

/** The confirmation page, opened with the order's private access token (`?o=`) */
export default async function ThanksPage({ searchParams }: PageProps<"/checkout/thanks">) {
  const { o, payment } = await searchParams;
  if (!checkoutOpen() || typeof o !== "string") notFound();
  const found = await orderForCustomer(o);
  if (!found) notFound();
  const { order, items } = found;
  const manual = order.paymentMethod === "manual";
  const [tracking, claim, wallets] = await Promise.all([
    orderTracking(order.id),
    manual ? latestManualPayment(order.id) : null,
    manual ? manualWallets() : [],
  ]);
  // bKash or Nagad: the transaction ID is with the team, or it wasn't found and can be sent again
  const checking = manual && claim?.status === "initiated";
  const notFound_ = manual && claim?.status === "failed";
  const cancelled = order.status === "cancelled";
  const paidWaiting = order.status === "pending_payment" && order.paymentStatus === "paid";
  const awaitingPayment = order.status === "pending_payment" && !paidWaiting;
  const expired = !!order.expiresAt && order.expiresAt <= new Date();
  const firstName = order.customerName.split(" ")[0];
  const held = order.expiresAt ? formatDateTime(order.expiresAt) : null;
  const waitingLine = manual
    ? checking
      ? `We have your transaction ID (${claim!.trxId}). We're checking the payment, and will confirm your order by email.`
      : notFound_
        ? `We couldn't find that payment${claim!.reason ? ` (${claim!.reason})` : ""}. Check the transaction ID and send it again. Your bottles are held until ${held}.`
        : `Send the payment by bKash or Nagad, then give us the transaction ID. Your bottles are held until ${held}.`
    : payment === "failed"
      ? `The payment didn't go through, and nothing was charged. Your bottles are held until ${held}.`
      : payment === "cancelled"
        ? `You left the payment page. Your bottles are held until ${held}.`
        : payment === "pending"
          ? "We're checking your payment with the bank. Refresh this page in a minute."
          : `Your bottles are held until ${held}. Complete the payment to confirm the order.`;

  return (
    <main id="main" className="bg-bone px-gutter text-noir min-h-svh pt-36 pb-24">
      <div className="grid grid-cols-12 gap-x-4 gap-y-12">
        <div className="col-span-12 md:col-span-5">
          <p className="eyebrow text-smoke">Order {order.number}</p>
          <h1 className="font-display mt-6 text-[clamp(3rem,7vw,7rem)] leading-[0.9]">
            {cancelled ? (
              <>
                This order
                <br />
                <span className="display-italic">was cancelled.</span>
              </>
            ) : paidWaiting ? (
              <>
                Paid.
                <br />
                <span className="display-italic">One moment.</span>
              </>
            ) : awaitingPayment ? (
              <>
                Almost
                <br />
                <span className="display-italic">yours.</span>
              </>
            ) : (
              <>
                {`Thank you, ${firstName}.`}
                <br />
                <span className="display-italic">It&rsquo;s on its way.</span>
              </>
            )}
          </h1>
          <p className="text-smoke mt-8 max-w-sm leading-relaxed">
            {cancelled
              ? "Nothing will be sent. If you paid, we'll contact you about your refund."
              : paidWaiting
                ? `Your payment came through. We're confirming your bottles, and will call ${formatPhone(order.customerPhone)}.`
                : awaitingPayment
                  ? expired && !checking
                    ? "This order waited too long, so the bottles went back on the shelf. Place it again from your bag."
                    : waitingLine
                  : `Your receipt is on its way to ${order.customerEmail}. The courier will call ${formatPhone(order.customerPhone)} before delivery.`}
          </p>
          {tracking?.url && !cancelled && (
            <a
              href={tracking.url}
              target="_blank"
              rel="noopener noreferrer"
              className="eyebrow bg-noir text-bone mt-10 inline-block px-8 py-5"
            >
              Track your parcel
            </a>
          )}
          {awaitingPayment && !expired && payment !== "pending" && !manual && (
            <PayNow token={o} total={order.total} />
          )}
          {awaitingPayment && !expired && manual && !checking && (
            <ManualPay token={o} total={order.total} reference={order.number} wallets={wallets} />
          )}
          <Link
            href="/#collection"
            className="eyebrow border-noir mt-10 inline-block border-b pb-1"
          >
            Back to the collection
          </Link>
        </div>

        <section
          aria-labelledby="order-title"
          className="border-noir/15 col-span-12 border-t pt-8 md:col-span-6 md:col-start-7"
        >
          <h2 id="order-title" className="eyebrow text-smoke">
            Your order
          </h2>
          <ul className="divide-noir/10 mt-6 divide-y">
            {items.map((i, n) => (
              <li key={n} className="flex items-baseline justify-between gap-6 py-5">
                <div>
                  <p className="font-display text-2xl leading-none">{i.name}</p>
                  <p className="text-smoke mt-1 text-sm">
                    {i.sizeMl} ml × {i.qty}
                  </p>
                </div>
                <p className="tabular-nums">{formatPrice(i.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <dl className="border-noir/15 mt-2 space-y-2 border-t pt-6 text-sm">
            <Row label="Subtotal" value={formatPrice(order.subtotal)} />
            {order.discount > 0 && (
              <Row
                label={order.couponCode ? `Discount, ${order.couponCode}` : "Discount"}
                value={formatPrice(-order.discount)}
              />
            )}
            <Row
              label={
                order.zone === "inside_dhaka" ? "Shipping, inside Dhaka" : "Shipping, outside Dhaka"
              }
              value={order.shippingFee ? formatPrice(order.shippingFee) : "Free"}
            />
          </dl>
          <div className="border-noir/15 mt-6 flex items-baseline justify-between border-t pt-6">
            <span className="eyebrow">Total</span>
            <span className="font-display text-4xl tabular-nums">{formatPrice(order.total)}</span>
          </div>

          <div className="border-noir/15 mt-10 grid grid-cols-2 gap-6 border-t pt-8 text-sm leading-relaxed">
            <div>
              <p className="eyebrow text-smoke">Delivering to</p>
              <p className="mt-3">{order.customerName}</p>
              <p>{order.addressStreet}</p>
              <p>{`${order.addressArea}, ${order.addressDistrict}`}</p>
            </div>
            <div>
              <p className="eyebrow text-smoke">Payment</p>
              <p className="mt-3">{PAYMENT_LABELS[order.paymentMethod]}</p>
              <p className="text-smoke">
                {order.paymentMethod === "cod"
                  ? "Pay the courier on delivery"
                  : checking
                    ? "Being checked"
                    : ({
                        paid: "Paid",
                        refunded: "Refunded",
                        partially_refunded: "Partly refunded",
                      }[order.paymentStatus as string] ?? "Awaiting payment")}
              </p>
              <p className="eyebrow text-smoke mt-6">Placed</p>
              <p className="mt-3">{formatDateTime(order.createdAt)}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-smoke">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

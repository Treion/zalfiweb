import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { PaymentBadge, StatusBadge } from "@/components/admin/orders/badges";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import { PAYMENT_LABELS } from "@/lib/checkout";
import { formatPrice } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { formatDateTime, formatRelative } from "@/lib/time";
import { requireAdmin } from "@/server/auth/session";
import { getOrderAdmin } from "@/server/orders/admin-query";
import { manualNext, offersRestock } from "@/server/orders/manage";
import { STATUS_LABELS, type OrderStatus } from "@/server/orders/state";
import { CopyButton, NoteForm, OrderActions } from "./OrderControls";

export async function generateMetadata({ params }: PageProps<"/admin/orders/[id]">) {
  return { title: `Order ${(await params).id}` };
}

const ZONE = { inside_dhaka: "Inside Dhaka", outside_dhaka: "Outside Dhaka" } as const;

function actorLabel(actor: string, adminName: string | null) {
  if (actor.startsWith("admin:")) return adminName ?? "An admin";
  return (
    { customer: "Customer", payment: "Payment", courier: "Courier", system: "ZALFI" }[actor] ??
    actor
  );
}

export default async function OrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const admin = await requireAdmin("orders.view");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const detail = await getOrderAdmin(id);
  if (!detail) notFound();
  const { order: o, items, events, customer } = detail;
  const next = manualNext(o);
  const address = `${o.addressStreet}, ${o.addressArea}, ${o.addressDistrict}`;
  const canManage = admin.can("orders.manage");

  return (
    <>
      <Link
        href="/admin/orders"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeftIcon className="size-4" /> Orders
      </Link>
      <PageHeader
        title={o.number}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={o.status} />
            <PaymentBadge status={o.paymentStatus} cod={o.paymentMethod === "cod"} />
            <span>Placed {formatDateTime(o.createdAt)}</span>
          </span>
        }
        actions={
          <OrderActions
            id={o.id}
            number={o.number}
            next={next}
            restockable={next.filter((s) => offersRestock(o.status, s))}
            canManage={canManage}
            email={o.customerEmail}
          />
        }
      />
      {o.status === "pending_payment" && o.expiresAt && (
        <p className="mb-6 rounded-lg border border-[var(--tone-warning-bg)] bg-[var(--tone-warning-bg)]/40 px-4 py-3 text-sm">
          Waiting for payment. The bottles are held until {formatDateTime(o.expiresAt)}, then the
          order cancels itself.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="text-muted-foreground text-left text-xs">
                  <tr>
                    <th className="pb-2 font-medium">Fragrance</th>
                    <th className="pb-2 font-medium">SKU</th>
                    <th className="pb-2 text-right font-medium">Qty</th>
                    <th className="pb-2 text-right font-medium">Price</th>
                    <th className="pb-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((i) => (
                    <tr key={i.id}>
                      <td className="py-2.5">
                        {i.name} <span className="text-muted-foreground">{i.sizeMl} ml</span>
                      </td>
                      <td className="text-muted-foreground py-2.5 font-mono text-xs">{i.sku}</td>
                      <td className="py-2.5 text-right tabular-nums">{i.qty}</td>
                      <td className="py-2.5 text-right tabular-nums">{formatPrice(i.unitPrice)}</td>
                      <td className="py-2.5 text-right tabular-nums">{formatPrice(i.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <dl className="mt-4 ml-auto flex max-w-xs flex-col gap-1.5 border-t pt-4 text-sm">
                <Line label="Subtotal" value={formatPrice(o.subtotal)} />
                {o.discount > 0 && (
                  <Line
                    label={o.couponCode ? `Discount (${o.couponCode})` : "Discount"}
                    value={formatPrice(-o.discount)}
                  />
                )}
                <Line
                  label={`Shipping (${ZONE[o.zone]})`}
                  value={o.shippingFee ? formatPrice(o.shippingFee) : "Free"}
                />
                <div className="mt-1 flex justify-between border-t pt-2 text-base font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatPrice(o.total)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>
                Everything that happened to this order, newest first.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {canManage && <NoteForm id={o.id} />}
              <ol className="relative flex flex-col gap-4 border-l pl-5">
                {events.map((e) => (
                  <li key={e.id} className="relative">
                    <span
                      aria-hidden
                      className={`absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-[var(--card)] ${e.type === "note" ? "bg-[var(--tone-info-fg)]" : e.toStatus ? "bg-foreground" : "bg-muted-foreground"}`}
                    />
                    <p className="text-sm">
                      {e.type === "note" ? (
                        <span className="font-medium">Note</span>
                      ) : e.toStatus ? (
                        <span className="font-medium">
                          {STATUS_LABELS[e.toStatus as OrderStatus] ?? e.toStatus}
                        </span>
                      ) : null}
                      {(e.type === "note" || e.toStatus) && e.message ? " · " : ""}
                      <span
                        className={
                          e.type === "note" ? "whitespace-pre-wrap" : "text-muted-foreground"
                        }
                      >
                        {e.message}
                      </span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {actorLabel(e.actor, e.adminName)} ·{" "}
                      <time
                        dateTime={e.createdAt.toISOString()}
                        title={formatDateTime(e.createdAt)}
                      >
                        {formatRelative(e.createdAt)}
                      </time>
                    </p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
              <CardDescription>
                {customer.orders <= 1
                  ? "First order"
                  : `${customer.orders} orders${admin.can("revenue.view") ? `, ${formatPrice(customer.spent)} paid` : ""}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div>
                <p className="font-medium">{o.customerName}</p>
                <p className="text-muted-foreground break-all">{o.customerEmail}</p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <a
                  href={`tel:${o.customerPhone}`}
                  className="tabular-nums underline-offset-4 hover:underline"
                >
                  {formatPhone(o.customerPhone)}
                </a>
                <CopyButton value={o.customerPhone} label="phone number" />
              </div>
              <div className="flex items-start justify-between gap-2 border-t pt-3">
                <div>
                  <p>{o.addressStreet}</p>
                  <p>
                    {o.addressArea}, {o.addressDistrict}
                  </p>
                  <p className="text-muted-foreground text-xs">{ZONE[o.zone]}</p>
                </div>
                <CopyButton value={address} label="address" />
              </div>
              {customer.orders > 1 && (
                <Link
                  href={`/admin/orders?q=${o.customerPhone}`}
                  className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
                >
                  See all their orders
                </Link>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5 text-sm">
              <Line label="Method" value={PAYMENT_LABELS[o.paymentMethod]} />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <PaymentBadge status={o.paymentStatus} cod={o.paymentMethod === "cod"} />
              </div>
              <Line
                label={o.paymentMethod === "cod" ? "To collect" : "Amount"}
                value={formatPrice(o.total)}
              />
              <p className="text-muted-foreground mt-2 text-xs">
                {o.paymentMethod === "cod"
                  ? "Marked paid when the order is delivered."
                  : "Transactions and refunds appear here once online payment is connected."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shipment</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5 text-sm">
              {o.courier || o.trackingCode ? (
                <>
                  <Line label="Courier" value={o.courier ?? "—"} />
                  <Line label="Tracking" value={o.trackingCode ?? "—"} />
                </>
              ) : (
                <p className="text-muted-foreground">
                  Not with a courier yet. Sending to Pathao or Steadfast arrives with shipping.
                </p>
              )}
              {o.receiptSentAt && (
                <p className="text-muted-foreground mt-2 border-t pt-2 text-xs">
                  E-receipt sent {formatRelative(o.receiptSentAt)}.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}

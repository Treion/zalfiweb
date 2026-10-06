import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, GiftIcon, PrinterIcon } from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { PaymentBadge, StatusBadge } from "@/components/admin/orders/badges";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import { formatPrice } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { formatDateTime, formatRelative } from "@/lib/time";
import { requireAdmin } from "@/server/auth/session";
import { getOrderAdmin } from "@/server/orders/admin-query";
import { manualNext, offersRestock } from "@/server/orders/manage";
import { STATUS_LABELS, type OrderStatus } from "@/server/orders/state";
import { CopyButton, NoteForm, OrderActions } from "./OrderControls";
import { PaymentPanel } from "./PaymentPanel";
import { orderPayments } from "@/server/payments/admin-query";
import { getSettings } from "@/server/settings";
import { availableCouriers } from "@/server/shipping/couriers";
import { orderShipments } from "@/server/shipping/service";
import { ShipmentPanel } from "./ShipmentPanel";
import { sizeLabel } from "@/lib/size";

export async function generateMetadata({ params }: PageProps<"/admin/orders/[id]">) {
  return { title: `Order ${(await params).id}` };
}

const EVENT_LABELS: Record<string, string> = {
  note: "Note",
  payment: "Payment",
  refund: "Refund",
  attention: "Needs attention",
  receipt: "Receipt",
};

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
  const [money, parcels, shipping] = await Promise.all([
    orderPayments(o),
    orderShipments(o.id),
    getSettings("shipping"),
  ]);
  const couriers = await availableCouriers();
  // The newest "needs attention" note, until an admin acts on it (moves the order or refunds it,
  // events being newest first) or the order is closed
  const flagged = events.findIndex((e) => e.type === "attention");
  const handled = events.findIndex(
    (e) => e.actor.startsWith("admin:") && (!!e.toStatus || e.type === "refund"),
  );
  const open = o.status !== "returned" && (o.status !== "cancelled" || o.paymentStatus === "paid");
  const attention =
    open && flagged >= 0 && (handled < 0 || handled > flagged) ? events[flagged] : undefined;
  // A parcel the courier has already brought back can't be re-attempted: only marked returned
  const back =
    o.status === "delivery_failed" && parcels.length > 0 && !parcels.some((p) => p.active);
  const next = manualNext(o).filter((st) => !(back && st === "shipped"));
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
            status={o.status}
          />
        }
      />
      {attention && (
        <p className="mb-6 rounded-lg border border-[var(--tone-warning-bg)] bg-[var(--tone-warning-bg)]/40 px-4 py-3 text-sm">
          <span className="font-medium">Needs attention: </span>
          {attention.message}
        </p>
      )}
      {o.status === "pending_payment" && o.paymentStatus !== "paid" && o.expiresAt && (
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
                        {i.name}{" "}
                        <span className="text-muted-foreground">
                          {sizeLabel(i.sizeMl, i.pieces)}
                        </span>
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
                      {e.toStatus ? (
                        <span className="font-medium">
                          {STATUS_LABELS[e.toStatus as OrderStatus] ?? e.toStatus}
                        </span>
                      ) : EVENT_LABELS[e.type] ? (
                        <span
                          className={`font-medium ${e.type === "attention" ? "text-[var(--tone-warning-fg)]" : ""}`}
                        >
                          {EVENT_LABELS[e.type]}
                        </span>
                      ) : null}
                      {(e.toStatus || EVENT_LABELS[e.type]) && e.message ? " · " : ""}
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
          {o.giftMessage && (
            <Card className="border-foreground/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GiftIcon className="size-4" /> A gift
                </CardTitle>
                <CardDescription>
                  Print the note and put it in the box. The label says so too.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="font-serif text-lg leading-snug whitespace-pre-line italic">
                  {o.giftMessage}
                </p>
                <Button variant="outline" size="sm" className="self-start" asChild>
                  <a href={`/api/admin/orders/${o.id}/gift-card`} target="_blank" rel="noreferrer">
                    <PrinterIcon /> Print gift card
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}
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

          <PaymentPanel
            order={o}
            data={money}
            canRefund={admin.can("refunds.issue")}
            canManage={canManage}
            canSeeRaw={admin.can("payments.raw")}
          />

          <ShipmentPanel
            order={o}
            shipments={parcels}
            couriers={couriers}
            defaultCourier={shipping.defaultCourier}
            canManage={admin.can("shipping.manage")}
            receiptSentAt={o.receiptSentAt}
          />
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

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { PaymentBadge, StatusBadge } from "@/components/admin/orders/badges";
import { BarList, StatTile } from "@/components/admin/charts/parts";
import { formatCount, formatTaka } from "@/components/admin/charts/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import { formatPrice } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { formatDate, formatDateTime, formatRelative } from "@/lib/time";
import { requireAdmin } from "@/server/auth/session";
import { getCustomerAdmin } from "@/server/customers/admin-query";
import { CopyButton } from "../../orders/[id]/OrderControls";

export async function generateMetadata({ params }: PageProps<"/admin/customers/[id]">) {
  return { title: `Customer ${(await params).id}` };
}

const ZONE = { inside_dhaka: "Inside Dhaka", outside_dhaka: "Outside Dhaka" } as const;

export default async function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  const admin = await requireAdmin("customers.view");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const detail = await getCustomerAdmin(id);
  if (!detail) notFound();
  const { customer: c, addresses, orders, favourites, stats } = detail;
  const money = admin.can("revenue.view");
  const canOrders = admin.can("orders.view");

  return (
    <>
      <Link
        href="/admin/customers"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeftIcon className="size-4" /> Customers
      </Link>
      <PageHeader
        title={c.name}
        description={`${formatPhone(c.phone)}${c.email ? ` · ${c.email}` : ""} · first seen ${formatDate(stats.firstAt ?? c.createdAt)}`}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Orders"
          value={formatCount(stats.orders)}
          compare={
            stats.placed > stats.orders
              ? `${formatCount(stats.placed)} placed; the rest unpaid, cancelled or returned`
              : "every one a sale"
          }
        />
        {money && (
          <>
            <StatTile label="Spent" value={formatTaka(stats.spent)} compare="less refunds" />
            <StatTile
              label="Average order"
              value={stats.orders ? formatTaka(stats.average) : "—"}
            />
          </>
        )}
        <StatTile
          label="Last order"
          value={stats.lastAt ? formatRelative(stats.lastAt) : "—"}
          compare={stats.lastAt ? formatDate(stats.lastAt) : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 lg:self-start">
          <CardHeader>
            <CardTitle>Orders</CardTitle>
            <CardDescription>Newest first.</CardDescription>
          </CardHeader>
          <CardContent>
            {orders.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground text-left text-xs">
                    <tr>
                      <th className="pb-2 font-medium">Order</th>
                      <th className="pb-2 font-medium">Placed</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 text-right font-medium">Bottles</th>
                      <th className="pb-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td className="py-2.5">
                          {canOrders ? (
                            <Link
                              href={`/admin/orders/${o.id}`}
                              className="font-medium tabular-nums underline-offset-4 hover:underline"
                            >
                              {o.number}
                            </Link>
                          ) : (
                            <span className="font-medium tabular-nums">{o.number}</span>
                          )}
                        </td>
                        <td
                          className="text-muted-foreground py-2.5 tabular-nums"
                          title={formatDateTime(o.createdAt)}
                        >
                          {formatDate(o.createdAt)}
                        </td>
                        <td className="py-2.5">
                          <span className="flex flex-wrap gap-1.5">
                            <StatusBadge status={o.status} />
                            <PaymentBadge
                              status={o.paymentStatus}
                              cod={o.paymentMethod === "cod"}
                            />
                          </span>
                        </td>
                        <td className="py-2.5 text-right tabular-nums">{o.bottles}</td>
                        <td className="py-2.5 text-right tabular-nums">
                          {formatPrice(o.total)}
                          {o.refunded > 0 && (
                            <span className="text-muted-foreground block text-xs">
                              {`${formatPrice(-o.refunded)} refunded`}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No orders yet.</p>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <a
                  href={`tel:${c.phone}`}
                  className="tabular-nums underline-offset-4 hover:underline"
                >
                  {formatPhone(c.phone)}
                </a>
                <CopyButton value={c.phone} label="phone number" />
              </div>
              {c.email && (
                <div className="flex items-center justify-between gap-2">
                  <a
                    href={`mailto:${c.email}`}
                    className="break-all underline-offset-4 hover:underline"
                  >
                    {c.email}
                  </a>
                  <CopyButton value={c.email} label="email" />
                </div>
              )}
              <p className="text-muted-foreground text-xs">
                The name and email of their latest order. Verified by a code sent to this phone.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Addresses</CardTitle>
              <CardDescription>
                {addresses.length > 1 ? `${addresses.length} used, newest first` : undefined}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col divide-y text-sm">
              {addresses.length ? (
                addresses.map((a) => {
                  const line = `${a.street}, ${a.area}, ${a.district}`;
                  return (
                    <div
                      key={line}
                      className="flex items-start justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                    >
                      <div>
                        <p>{a.street}</p>
                        <p>
                          {a.area}, {a.district}
                        </p>
                        <p className="text-muted-foreground text-xs">{ZONE[a.zone]}</p>
                      </div>
                      <CopyButton value={line} label="address" />
                    </div>
                  );
                })
              ) : (
                <p className="text-muted-foreground">None yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Their fragrances</CardTitle>
              <CardDescription>Bottles bought, all time.</CardDescription>
            </CardHeader>
            <CardContent>
              <BarList
                dense
                rows={favourites.map((f) => ({
                  key: f.name,
                  label: f.name,
                  value: f.bottles,
                  display: formatCount(f.bottles),
                }))}
                empty="Nothing bought yet."
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

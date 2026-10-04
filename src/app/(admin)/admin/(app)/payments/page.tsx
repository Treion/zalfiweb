import Link from "next/link";
import { CreditCardIcon } from "lucide-react";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { EmptyState } from "@/components/admin/shell/EmptyState";
import { readListParams } from "@/components/admin/data-table/url-state";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/admin/ui/card";
import { formatPrice } from "@/lib/money";
import { requireAdmin } from "@/server/auth/session";
import {
  PAYMENT_FILTER_KEYS,
  listPaymentsAdmin,
  listRefundsAdmin,
} from "@/server/payments/admin-query";
import { gatewaySummary } from "@/server/payments/providers";
import { PaymentsTable, RefundsTable } from "./PaymentsTable";

export const metadata = { title: "Payments" };

export default async function PaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  const admin = await requireAdmin("payments.view");
  const sp = await searchParams;
  const view = sp.view === "refunds" ? "refunds" : "transactions";
  const p = readListParams(sp, { filterKeys: PAYMENT_FILTER_KEYS, pageSize: 50 });
  const money = admin.can("revenue.view");
  const gateway = await gatewaySummary();

  const tx = view === "transactions" ? await listPaymentsAdmin(p) : null;
  const rf = view === "refunds" ? await listRefundsAdmin(p) : null;
  const stats = tx
    ? [
        { label: "Collected online", value: money ? formatPrice(tx.sums.collected) : "—" },
        { label: "Refunded", value: money ? formatPrice(tx.sums.refunded) : "—" },
        {
          label: "Net",
          value: money ? formatPrice(tx.sums.collected - tx.sums.refunded) : "—",
        },
        {
          label: "Paid / failed",
          value: `${tx.sums.paidCount} / ${tx.sums.failedCount}`,
        },
      ]
    : [];

  return (
    <>
      <PageHeader title="Payments" description={`Online payments and refunds. ${gateway.note}`} />
      <nav
        aria-label="Payment views"
        className="bg-muted text-muted-foreground mb-4 inline-flex h-9 items-center rounded-lg p-[3px] text-sm"
      >
        {(["transactions", "refunds"] as const).map((v) => (
          <Link
            key={v}
            href={v === "transactions" ? "/admin/payments" : "/admin/payments?view=refunds"}
            aria-current={view === v ? "page" : undefined}
            className={`rounded-md px-3 py-1 font-medium ${view === v ? "bg-background text-foreground shadow-sm" : "hover:text-foreground"}`}
          >
            {v === "transactions" ? "Transactions" : "Refunds"}
          </Link>
        ))}
      </nav>
      {tx && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((s) => (
              <Card key={s.label} className="gap-1 py-4">
                <CardHeader className="px-4">
                  <CardDescription>{s.label}</CardDescription>
                </CardHeader>
                <CardContent className="px-4 text-2xl font-semibold tabular-nums">
                  {s.value}
                </CardContent>
              </Card>
            ))}
          </div>
          {tx.total || p.q || Object.keys(p.filters).length ? (
            <PaymentsTable rows={tx.rows} total={tx.total} page={p.page} pageSize={p.pageSize} />
          ) : (
            <EmptyState icon={CreditCardIcon} title="No online payments yet">
              Each attempt to pay online appears here, paid or not.
            </EmptyState>
          )}
        </>
      )}
      {rf && <RefundsTable rows={rf.rows} total={rf.total} page={p.page} pageSize={p.pageSize} />}
    </>
  );
}

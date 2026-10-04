import { UsersIcon } from "lucide-react";
import { count, sql } from "drizzle-orm";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { EmptyState } from "@/components/admin/shell/EmptyState";
import { readListParams } from "@/components/admin/data-table/url-state";
import { StatTile } from "@/components/admin/charts/parts";
import { formatCount, formatTaka, percent } from "@/components/admin/charts/format";
import { customers, orders } from "@/db/schema";
import { requireAdmin } from "@/server/auth/session";
import {
  CUSTOMER_FILTER_KEYS,
  CUSTOMER_SORT_KEYS,
  listCustomersAdmin,
} from "@/server/customers/admin-query";
import { poolDb } from "@/server/db/pool";
import { REFUNDED, SOLD } from "@/server/reports/metrics";
import { CustomersTable } from "./CustomersTable";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  const admin = await requireAdmin("customers.view");
  const sp = await searchParams;
  const p = readListParams(sp, {
    filterKeys: CUSTOMER_FILTER_KEYS,
    sortKeys: CUSTOMER_SORT_KEYS,
    defaultSort: "last",
  });
  const money = admin.can("revenue.view");
  const db = poolDb();
  const [{ rows, total }, [all], [buyers]] = await Promise.all([
    listCustomersAdmin(p),
    db.select({ n: count() }).from(customers),
    db
      .select({
        buyers: sql<number>`count(distinct ${orders.customerId})::int`,
        repeat: sql<number>`(select count(*)::int from (select o.customer_id from orders o where o.status not in ('pending_payment', 'cancelled', 'returned') and o.customer_id is not null group by o.customer_id having count(*) >= 2) x)`,
        spent: sql<number>`coalesce(sum(${orders.total} - ${REFUNDED}), 0)::bigint`,
      })
      .from(orders)
      .where(sql`${SOLD} and ${orders.customerId} is not null`),
  ]);
  const people = all?.n ?? 0;
  const paying = Number(buyers?.buyers ?? 0);
  const stats = [
    { label: "Customers", value: formatCount(people) },
    {
      label: "Came back for more",
      value: percent(Number(buyers?.repeat ?? 0), paying),
      compare: `${formatCount(Number(buyers?.repeat ?? 0))} of ${formatCount(paying)} who bought`,
    },
    ...(money
      ? [
          {
            label: "Spent per customer",
            value: paying ? formatTaka(Number(buyers?.spent ?? 0) / paying) : "—",
            compare: "on average, all time",
          },
        ]
      : []),
  ];
  const filtered = !!p.q || Object.keys(p.filters).length > 0;

  return (
    <>
      <PageHeader
        title="Customers"
        description="One per verified phone number, built from checkout. Open one to see every order."
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <StatTile key={s.label} label={s.label} value={s.value} compare={s.compare} />
        ))}
      </div>
      {total || filtered ? (
        <CustomersTable
          rows={rows}
          total={total}
          page={p.page}
          pageSize={p.pageSize}
          money={money}
          canExport={admin.can("exports.csv")}
        />
      ) : (
        <EmptyState icon={UsersIcon} title="No customers yet">
          A customer appears here the first time they verify their phone and place an order.
        </EmptyState>
      )}
    </>
  );
}

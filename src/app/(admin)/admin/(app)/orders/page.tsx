import Link from "next/link";
import { ReceiptTextIcon } from "lucide-react";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { EmptyState } from "@/components/admin/shell/EmptyState";
import { readListParams } from "@/components/admin/data-table/url-state";
import { requireAdmin } from "@/server/auth/session";
import {
  ORDER_FILTER_KEYS,
  ORDER_SORT_KEYS,
  ORDER_VIEWS,
  listOrdersAdmin,
} from "@/server/orders/admin-query";
import { OrdersTable } from "./OrdersTable";

export const metadata = { title: "Orders" };

const VIEWS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "to_pack", label: "To pack" },
  { key: "to_ship", label: "To ship" },
  { key: "in_transit", label: "On the way" },
  { key: "problems", label: "Needs attention" },
];

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdmin("orders.view");
  const sp = await searchParams;
  const p = readListParams(sp, {
    filterKeys: ORDER_FILTER_KEYS,
    sortKeys: ORDER_SORT_KEYS,
    defaultSort: "created",
  });
  const view = p.filters.view && p.filters.view in ORDER_VIEWS ? p.filters.view : "";
  const { rows, total } = await listOrdersAdmin(p);
  const anyOrders = total > 0 || !!p.q || Object.keys(p.filters).length > 0;

  return (
    <>
      <PageHeader
        title="Orders"
        description="Newest first. Open an order to pack it, move it along, or print its invoice."
      />
      <nav
        aria-label="Order views"
        className="bg-muted text-muted-foreground mb-4 inline-flex h-9 max-w-full items-center overflow-x-auto rounded-lg p-[3px] text-sm"
      >
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={v.key ? `/admin/orders?view=${v.key}` : "/admin/orders"}
            aria-current={view === v.key ? "page" : undefined}
            className={`rounded-md px-3 py-1 font-medium whitespace-nowrap ${view === v.key ? "bg-background text-foreground shadow-sm" : "hover:text-foreground"}`}
          >
            {v.label}
          </Link>
        ))}
      </nav>
      {anyOrders ? (
        <OrdersTable rows={rows} total={total} page={p.page} pageSize={p.pageSize} />
      ) : (
        <EmptyState icon={ReceiptTextIcon} title="No orders yet">
          Orders placed on the shop appear here the moment they come in.
        </EmptyState>
      )}
    </>
  );
}

import Link from "next/link";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { readListParams } from "@/components/admin/data-table/url-state";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/admin/ui/card";
import { requireAdmin } from "@/server/auth/session";
import { listInventory, listMovements, MOVEMENT_TYPES } from "@/server/catalog/inventory";
import { ADJUST_REASONS } from "@/server/catalog/schema";
import { formatPrice } from "@/lib/money";
import { HistoryTable } from "./HistoryTable";
import { StockTable } from "./StockTable";

export const metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  const admin = await requireAdmin("inventory.manage");
  const sp = await searchParams;
  const view = sp.view === "history" ? "history" : "stock";
  const rows = await listInventory();
  const live = rows.filter((r) => r.active && r.published);
  const units = live.reduce((n, r) => n + r.stock, 0);
  const value = live.reduce((n, r) => n + r.value, 0);
  const low = live.filter((r) => r.level === "low").length;
  const out = live.filter((r) => r.level === "out").length;
  const stats = [
    { label: "Bottles in stock", value: units.toLocaleString("en-IN") },
    {
      label: "Stock value (at shop prices)",
      value: admin.can("revenue.view") ? formatPrice(value) : "—",
    },
    { label: "Low on stock", value: String(low), tone: low ? "text-[var(--tone-warning-fg)]" : "" },
    { label: "Sold out", value: String(out), tone: out ? "text-[var(--tone-danger-fg)]" : "" },
  ];

  const p = readListParams(sp, { filterKeys: ["type", "days", "variant"], pageSize: 50 });
  const history = view === "history" ? await listMovements(p) : null;

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Every stock change is recorded with a reason. Held bottles belong to unpaid orders."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="gap-1 py-4">
            <CardHeader className="px-4">
              <CardDescription>{s.label}</CardDescription>
            </CardHeader>
            <CardContent className={`px-4 text-2xl font-semibold tabular-nums ${s.tone ?? ""}`}>
              {s.value}
            </CardContent>
          </Card>
        ))}
      </div>

      <nav
        aria-label="Inventory views"
        className="bg-muted text-muted-foreground mb-4 inline-flex h-9 items-center rounded-lg p-[3px] text-sm"
      >
        {(["stock", "history"] as const).map((v) => (
          <Link
            key={v}
            href={v === "stock" ? "/admin/inventory" : "/admin/inventory?view=history"}
            aria-current={view === v ? "page" : undefined}
            className={`rounded-md px-3 py-1 font-medium ${view === v ? "bg-background text-foreground shadow-sm" : "hover:text-foreground"}`}
          >
            {v === "stock" ? "Stock" : "History"}
          </Link>
        ))}
      </nav>

      {view === "stock" ? (
        <StockTable
          rows={rows}
          reasons={ADJUST_REASONS.map((r) => ({ value: r.value, label: r.label }))}
          openFor={typeof sp.adjust === "string" ? Number(sp.adjust) : null}
          showValue={admin.can("revenue.view")}
        />
      ) : (
        <HistoryTable
          rows={history!.rows}
          total={history!.total}
          page={p.page}
          pageSize={p.pageSize}
          types={MOVEMENT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          sizes={rows.map((r) => ({
            value: String(r.variantId),
            label: `${r.name} ${r.sizeMl} ml`,
          }))}
        />
      )}
    </>
  );
}

import Link from "next/link";
import { PackageXIcon, TruckIcon, Undo2Icon } from "lucide-react";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { EmptyState } from "@/components/admin/shell/EmptyState";
import { readListParams } from "@/components/admin/data-table/url-state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import { formatPrice } from "@/lib/money";
import { requireAdmin } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import {
  SHIPMENT_FILTER_KEYS,
  SHIPPING_VIEWS,
  courierSummary,
  listReturnsAdmin,
  listShipmentsAdmin,
  type ShippingView,
} from "@/server/shipping/admin-query";
import { availableCouriers } from "@/server/shipping/couriers";
import { COURIER_LABELS } from "@/server/shipping/types";
import { ReturnsTable, ShipmentsTable } from "./ShippingTables";

export const metadata = { title: "Shipping" };

const VIEW_LABELS: Record<ShippingView, string> = {
  on_the_way: "On the way",
  failed: "Failed deliveries",
  returns: "Returns",
  all: "All parcels",
};

const EMPTY: Record<Exclude<ShippingView, "returns">, { title: string; body: string }> = {
  on_the_way: {
    title: "No parcels on the way",
    body: "Send an order to a courier from its page, or several at once from Orders.",
  },
  failed: {
    title: "No failed deliveries",
    body: "When a courier can't deliver, the parcel waits here for a re-attempt or a return.",
  },
  all: { title: "No parcels yet", body: "Every parcel sent with a courier appears here." },
};

export default async function ShippingPage({ searchParams }: PageProps<"/admin/shipping">) {
  const admin = await requireAdmin("shipping.manage");
  const sp = await searchParams;
  const view: ShippingView = (SHIPPING_VIEWS as readonly string[]).includes(String(sp.view))
    ? (sp.view as ShippingView)
    : "on_the_way";
  const p = readListParams(sp, { filterKeys: SHIPMENT_FILTER_KEYS, pageSize: 50 });
  const money = admin.can("revenue.view");
  const [couriers, summary, shipping, list, rets] = await Promise.all([
    availableCouriers(),
    courierSummary(30),
    getSettings("shipping"),
    view === "returns" ? null : listShipmentsAdmin(view, p),
    view === "returns" ? listReturnsAdmin(p) : null,
  ]);
  const filtered = !!p.q || Object.keys(p.filters).some((k) => k !== "view");

  // A card per courier that is set up or has parcels
  const names = [...new Set([...couriers.map((c) => c.name), ...summary.map((s) => s.courier)])];
  const cards = names.map((name) => ({
    name,
    option: couriers.find((c) => c.name === name),
    s: summary.find((s) => s.courier === name) ?? {
      onTheWay: 0,
      toCollect: 0,
      delivered: 0,
      collected: 0,
      failed: 0,
      returned: 0,
    },
  }));
  const failedTotal = summary.reduce((n, s) => n + s.failed, 0);

  return (
    <>
      <PageHeader
        title="Shipping"
        description={`Parcels with couriers, and the cash they collect for you. New parcels go with ${COURIER_LABELS[shipping.defaultCourier]} unless you choose another.`}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ name, option, s }) => (
          <Card key={name} className="gap-3 py-4">
            <CardHeader className="px-4">
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                {COURIER_LABELS[name]}
                <span className="text-muted-foreground text-xs font-normal">
                  {option
                    ? option.mode === "live"
                      ? "Live"
                      : option.mode === "sandbox"
                        ? "Sandbox"
                        : "Test"
                    : "Not set up"}
                </span>
              </CardTitle>
              <CardDescription>
                {`${s.onTheWay} on the way · ${s.delivered} delivered · ${s.returned} returned`}
                {s.failed ? ` · ${s.failed} failed` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 px-4">
              <div>
                <p className="text-muted-foreground text-xs">Collected, last 30 days</p>
                <p className="text-xl font-semibold tabular-nums">
                  {money ? formatPrice(s.collected) : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Still to collect</p>
                <p className="text-xl font-semibold tabular-nums">
                  {money ? formatPrice(s.toCollect) : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {money && cards.length > 0 && (
        <p className="text-muted-foreground -mt-3 mb-6 text-xs">
          Collected is the cash on delivery for parcels delivered: what the courier owes you before
          its payout. Check it against the courier&apos;s statement.
        </p>
      )}

      <nav
        aria-label="Shipping views"
        className="bg-muted text-muted-foreground mb-4 inline-flex h-9 max-w-full items-center overflow-x-auto rounded-lg p-[3px] text-sm"
      >
        {SHIPPING_VIEWS.map((v) => (
          <Link
            key={v}
            href={v === "on_the_way" ? "/admin/shipping" : `/admin/shipping?view=${v}`}
            aria-current={view === v ? "page" : undefined}
            className={`rounded-md px-3 py-1 font-medium whitespace-nowrap ${view === v ? "bg-background text-foreground shadow-sm" : "hover:text-foreground"}`}
          >
            {VIEW_LABELS[v]}
            {v === "failed" && failedTotal > 0 ? ` (${failedTotal})` : ""}
          </Link>
        ))}
      </nav>

      {list &&
        view !== "returns" &&
        (list.total || filtered ? (
          <ShipmentsTable
            view={view}
            rows={list.rows}
            total={list.total}
            page={p.page}
            pageSize={p.pageSize}
          />
        ) : (
          <EmptyState icon={view === "failed" ? PackageXIcon : TruckIcon} title={EMPTY[view].title}>
            {EMPTY[view].body}
          </EmptyState>
        ))}
      {rets &&
        (rets.total || filtered ? (
          <ReturnsTable rows={rets.rows} total={rets.total} page={p.page} pageSize={p.pageSize} />
        ) : (
          <EmptyState icon={Undo2Icon} title="No returns">
            A parcel that comes back is recorded on its order page: why, its condition, and whether
            the bottles went back on the shelf.
          </EmptyState>
        ))}
    </>
  );
}

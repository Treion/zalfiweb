import Link from "next/link";
import { count, eq, sql } from "drizzle-orm";
import { CheckCircle2Icon, CircleIcon } from "lucide-react";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { Badge } from "@/components/admin/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import { adminUsers, fragrances, settings, variants } from "@/db/schema";
import { poolDb } from "@/server/db/pool";
import { getAllSettings } from "@/server/settings";
import { requireAdmin } from "@/server/auth/session";
import { formatPrice } from "@/lib/money";

export const metadata = { title: "Overview" };

/**
 * The overview. Charts, today's numbers and the "needs attention" list arrive with orders
 * (phases 4–7); until then it shows the catalogue at a glance and what's left to set up.
 */
export default async function OverviewPage() {
  const admin = await requireAdmin("dashboard.view");
  const db = poolDb();
  const [cfg, [team], [cat], saved] = await Promise.all([
    getAllSettings(db),
    db.select({ n: count() }).from(adminUsers).where(eq(adminUsers.active, true)),
    db
      .select({
        fragrances: sql<number>`count(distinct ${fragrances.id})::int`,
        sizes: sql<number>`count(${variants.id})::int`,
        units: sql<number>`coalesce(sum(${variants.stock}), 0)::int`,
        value: sql<number>`coalesce(sum(${variants.stock} * ${variants.pricePoisha}), 0)::bigint`,
      })
      .from(fragrances)
      .leftJoin(variants, eq(variants.fragranceId, fragrances.id)),
    db.select({ key: settings.key }).from(settings),
  ]);
  const savedKeys = new Set(saved.map((s) => s.key));
  const low = await db
    .select({ n: count() })
    .from(variants)
    .where(
      sql`${variants.active} and ${variants.stock} <= coalesce(${variants.lowStockThreshold}, ${cfg.inventory.lowStockThreshold})`,
    );

  const steps = [
    { done: true, label: "Owner account created" },
    { done: (team?.n ?? 0) > 1, label: "Invite your managers", href: "/admin/team", owner: true },
    { done: savedKeys.has("store"), label: "Check the store details", href: "/admin/settings" },
    {
      done: !!cfg.invoice.businessName,
      label: "Add invoice details (optional)",
      href: "/admin/settings",
    },
    {
      done: savedKeys.has("shipping"),
      label: "Review shipping fees and Dhaka areas",
      href: "/admin/settings",
    },
    { done: false, label: "Set real prices in taka", note: "Products, phase 3" },
  ];

  const stats = [
    { label: "Fragrances", value: String(cat?.fragrances ?? 0) },
    { label: "Sizes on sale", value: String(cat?.sizes ?? 0) },
    { label: "Bottles in stock", value: String(cat?.units ?? 0) },
    {
      label: "Stock value",
      value: admin.can("revenue.view") ? formatPrice(Number(cat?.value ?? 0)) : "—",
    },
  ];

  return (
    <>
      <PageHeader
        title={`Good to see you, ${admin.user.name.split(" ")[0]}`}
        description="The store at a glance."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="gap-2">
            <CardHeader>
              <CardDescription>{s.label}</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold tabular-nums">{s.value}</CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Getting ready to sell</CardTitle>
            <CardDescription>
              What&rsquo;s set up, and what&rsquo;s left before orders open.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {steps
                .filter((s) => !s.owner || admin.can("team.manage"))
                .map((s) => (
                  <li key={s.label} className="flex items-center gap-3 py-3 text-sm">
                    {s.done ? (
                      <CheckCircle2Icon className="size-4 text-[var(--tone-success-fg)]" />
                    ) : (
                      <CircleIcon className="text-muted-foreground size-4" />
                    )}
                    <span className={s.done ? "text-muted-foreground line-through" : ""}>
                      {s.label}
                    </span>
                    {s.href && !s.done && (
                      <Link
                        href={s.href}
                        className="text-gold ml-auto text-sm underline-offset-4 hover:underline"
                      >
                        Open
                      </Link>
                    )}
                    {s.note && (
                      <span className="text-muted-foreground ml-auto text-xs">{s.note}</span>
                    )}
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Selling</CardTitle>
            <CardDescription>How customers can pay, from Settings.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Online payment (SSLCommerz)</span>
              <Badge variant={cfg.payments.sslcommerzEnabled ? "success" : "neutral"}>
                {cfg.payments.sslcommerzEnabled ? "On" : "Off"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Cash on Delivery</span>
              <Badge variant={cfg.payments.codEnabled ? "success" : "neutral"}>
                {cfg.payments.codEnabled ? "On" : "Off"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Low-stock sizes</span>
              <Badge variant={(low[0]?.n ?? 0) > 0 ? "warning" : "neutral"}>{low[0]?.n ?? 0}</Badge>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              Orders, revenue and charts appear here as soon as checkout opens.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

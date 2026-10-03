import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { CouponForm } from "@/components/admin/coupons/CouponForm";
import { Badge } from "@/components/admin/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/admin/ui/card";
import { formatPrice } from "@/lib/money";
import { formatRelative } from "@/lib/time";
import { requireAdmin } from "@/server/auth/session";
import { couponTargets, getCouponAdmin } from "@/server/coupons";
import { COUPON_STATES, describeCoupon } from "@/components/admin/coupons/labels";
import { CouponDanger } from "./CouponDanger";

export const metadata = { title: "Coupon" };

export default async function CouponPage({ params }: PageProps<"/admin/coupons/[id]">) {
  const admin = await requireAdmin("coupons.manage");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [c, targets] = await Promise.all([getCouponAdmin(id), couponTargets()]);
  if (!c) notFound();
  const money = admin.can("revenue.view");
  const stats = [
    { label: "Uses", value: `${c.uses}${c.usageLimit !== null ? ` of ${c.usageLimit}` : ""}` },
    { label: "Revenue", value: money ? formatPrice(c.revenue) : "—" },
    { label: "Discount given", value: money ? formatPrice(c.discountGiven) : "—" },
    { label: "Last used", value: c.lastUsed ? formatRelative(c.lastUsed) : "Not yet" },
  ];
  return (
    <div className="max-w-4xl">
      <Link
        href="/admin/coupons"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeftIcon className="size-4" /> Coupons
      </Link>
      <PageHeader
        title={c.code}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={COUPON_STATES[c.state].tone}>{COUPON_STATES[c.state].label}</Badge>
            {describeCoupon(c)}
          </span>
        }
        actions={
          c.uses > 0 ? (
            <Link
              href={`/admin/orders?coupon=${encodeURIComponent(c.code)}`}
              className="text-sm underline-offset-4 hover:underline"
            >
              See its orders
            </Link>
          ) : null
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
      <CouponForm id={c.id} initial={c} targets={targets} />
      <CouponDanger id={c.id} code={c.code} used={c.uses > 0} />
    </div>
  );
}

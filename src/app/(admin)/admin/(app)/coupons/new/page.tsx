import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { CouponForm } from "@/components/admin/coupons/CouponForm";
import { requireAdmin } from "@/server/auth/session";
import { couponTargets } from "@/server/coupons";

export const metadata = { title: "New coupon" };

export default async function NewCouponPage() {
  await requireAdmin("coupons.manage");
  return (
    <div className="max-w-4xl">
      <Link
        href="/admin/coupons"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeftIcon className="size-4" /> Coupons
      </Link>
      <PageHeader title="New coupon" />
      <CouponForm id={null} initial={null} targets={await couponTargets()} />
    </div>
  );
}

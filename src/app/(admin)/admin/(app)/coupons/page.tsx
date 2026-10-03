import Link from "next/link";
import { PlusIcon, TicketPercentIcon } from "lucide-react";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { EmptyState } from "@/components/admin/shell/EmptyState";
import { Button } from "@/components/admin/ui/button";
import { requireAdmin } from "@/server/auth/session";
import { listCouponsAdmin } from "@/server/coupons";
import { CouponsTable } from "./CouponsTable";

export const metadata = { title: "Coupons" };

export default async function CouponsPage({ searchParams }: PageProps<"/admin/coupons">) {
  const admin = await requireAdmin("coupons.manage");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toUpperCase() : "";
  const state = typeof sp.state === "string" ? sp.state : "";
  const all = await listCouponsAdmin();
  const rows = all.filter(
    (c) =>
      (!q || c.code.includes(q) || c.description.toUpperCase().includes(q)) &&
      (!state || c.state === state),
  );
  const newButton = (
    <Button asChild>
      <Link href="/admin/coupons/new">
        <PlusIcon /> New coupon
      </Link>
    </Button>
  );
  return (
    <>
      <PageHeader
        title="Coupons"
        description="One code per order. Uses, revenue and discount count orders that weren't cancelled."
        actions={newButton}
      />
      {all.length ? (
        <CouponsTable rows={rows} showRevenue={admin.can("revenue.view")} />
      ) : (
        <EmptyState icon={TicketPercentIcon} title="No coupons yet" action={newButton}>
          A percentage or amount off, free shipping, a first-order welcome: make one in a minute.
        </EmptyState>
      )}
    </>
  );
}

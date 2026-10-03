import { cookies } from "next/headers";
import { NAV } from "@/components/admin/shell/nav";
import { SIDEBAR_COOKIE, Sidebar } from "@/components/admin/shell/Sidebar";
import { Topbar } from "@/components/admin/shell/Topbar";
import { requireAdmin } from "@/server/auth/session";
import { lowStockCount } from "@/server/catalog/inventory";
import { ordersToPackCount } from "@/server/orders/admin-query";

/** The signed-in admin: sidebar, top bar and the page. Every page also checks its own permission. */
export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const allowed = NAV.flatMap((g) => g.items)
    .filter((i) => admin.can(i.permission))
    .map((i) => i.href);
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "1";
  const badges: Record<string, number> = {};
  const [low, toPack] = await Promise.all([
    admin.can("inventory.manage") ? lowStockCount().catch(() => 0) : 0,
    admin.can("orders.view") ? ordersToPackCount().catch(() => 0) : 0,
  ]);
  if (low) badges["/admin/inventory"] = low;
  if (toPack) badges["/admin/orders"] = toPack;
  return (
    <div className="flex min-h-svh">
      <Sidebar allowed={allowed} badges={badges} initialCollapsed={collapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          me={{ name: admin.user.name, email: admin.user.email, role: admin.user.role }}
          allowed={allowed}
          badges={badges}
        />
        <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-6 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

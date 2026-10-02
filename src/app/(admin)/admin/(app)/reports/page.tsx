import { ComingSoon } from "@/components/admin/shell/ComingSoon";
import { requireAdmin } from "@/server/auth/session";

export const metadata = { title: "Reports" };

export default async function Page() {
  await requireAdmin("reports.view");
  return (
    <ComingSoon title="Reports" phase={7}>
      Sales, products, sizes, inventory value, coupons, zones, refunds and returns, with CSV export.
    </ComingSoon>
  );
}

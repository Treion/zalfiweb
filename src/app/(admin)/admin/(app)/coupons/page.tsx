import { ComingSoon } from "@/components/admin/shell/ComingSoon";
import { requireAdmin } from "@/server/auth/session";

export const metadata = { title: "Coupons" };

export default async function Page() {
  await requireAdmin("coupons.manage");
  return (
    <ComingSoon title="Coupons" phase={4}>
      Create and edit coupons, with usage, revenue and discount per coupon.
    </ComingSoon>
  );
}

import { ComingSoon } from "@/components/admin/shell/ComingSoon";
import { requireAdmin } from "@/server/auth/session";

export const metadata = { title: "Inventory" };

export default async function Page() {
  await requireAdmin("inventory.manage");
  return (
    <ComingSoon title="Inventory" phase={3}>
      Stock, reserved and available per size, quick adjustments with a reason, and the full history.
    </ComingSoon>
  );
}

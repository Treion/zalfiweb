import { ComingSoon } from "@/components/admin/shell/ComingSoon";
import { requireAdmin } from "@/server/auth/session";

export const metadata = { title: "Shipping" };

export default async function Page() {
  await requireAdmin("shipping.manage");
  return (
    <ComingSoon title="Shipping" phase={6}>
      Shipments by courier and status, failed deliveries, returns and COD expected.
    </ComingSoon>
  );
}

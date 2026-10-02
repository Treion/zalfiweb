import { ComingSoon } from "@/components/admin/shell/ComingSoon";
import { requireAdmin } from "@/server/auth/session";

export const metadata = { title: "Orders" };

export default async function Page() {
  await requireAdmin("orders.view");
  return (
    <ComingSoon title="Orders" phase={4}>
      Every order with filters, bulk actions and a detail page: customer, items, payment, shipment
      and timeline.
    </ComingSoon>
  );
}

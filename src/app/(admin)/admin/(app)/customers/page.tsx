import { ComingSoon } from "@/components/admin/shell/ComingSoon";
import { requireAdmin } from "@/server/auth/session";

export const metadata = { title: "Customers" };

export default async function Page() {
  await requireAdmin("customers.view");
  return (
    <ComingSoon title="Customers" phase={7}>
      Customers built from verified phone numbers: orders, total spent, addresses.
    </ComingSoon>
  );
}

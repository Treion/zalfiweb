import { ComingSoon } from "@/components/admin/shell/ComingSoon";
import { requireAdmin } from "@/server/auth/session";

export const metadata = { title: "Payments" };

export default async function Page() {
  await requireAdmin("payments.view");
  return (
    <ComingSoon title="Payments" phase={5}>
      Every transaction with filters, totals and refunds.
    </ComingSoon>
  );
}

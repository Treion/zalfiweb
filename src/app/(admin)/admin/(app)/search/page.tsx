import { ComingSoon } from "@/components/admin/shell/ComingSoon";
import { requireAdmin } from "@/server/auth/session";

export const metadata = { title: "Search" };

export default async function Page() {
  await requireAdmin("dashboard.view");
  return (
    <ComingSoon title="Search" phase={7}>
      One search for orders (by number, phone or name) and products (by name).
    </ComingSoon>
  );
}

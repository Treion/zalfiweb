import { ComingSoon } from "@/components/admin/shell/ComingSoon";
import { requireAdmin } from "@/server/auth/session";

export const metadata = { title: "Products" };

export default async function Page() {
  await requireAdmin("products.manage");
  return (
    <ComingSoon title="Products" phase={3}>
      Edit fragrances, sizes, prices, images and visibility. Changes show on the site at once.
    </ComingSoon>
  );
}

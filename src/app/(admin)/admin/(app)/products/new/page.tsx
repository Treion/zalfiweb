import { PageHeader } from "@/components/admin/shell/PageHeader";
import { requireAdmin } from "@/server/auth/session";
import { NewFragranceForm } from "./NewFragranceForm";

export const metadata = { title: "New fragrance" };

export default async function NewFragrancePage() {
  await requireAdmin("products.manage");
  return (
    <>
      <PageHeader
        title="New fragrance"
        description="It starts hidden. Add its sizes, prices and notes, then publish it."
      />
      <NewFragranceForm />
    </>
  );
}

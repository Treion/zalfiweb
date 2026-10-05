import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { NewSetForm } from "@/components/admin/catalog/SetEditor";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { requireAdmin } from "@/server/auth/session";
import { setFragranceChoices } from "@/server/catalog/sets";

export const metadata = { title: "New discovery set" };

export default async function NewSetPage() {
  await requireAdmin("products.manage");
  return (
    <>
      <Link
        href="/admin/products#sets"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeftIcon className="size-4" /> Products
      </Link>
      <PageHeader
        title="New discovery set"
        description="Three fragrances in small vials, sold as one box."
      />
      <NewSetForm choices={await setFragranceChoices()} />
    </>
  );
}

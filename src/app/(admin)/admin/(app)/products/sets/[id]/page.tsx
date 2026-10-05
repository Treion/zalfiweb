import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import {
  SetContentsCard,
  SetDetailsCard,
  SetPackCard,
  SetPhotoCard,
} from "@/components/admin/catalog/SetEditor";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { requireAdmin } from "@/server/auth/session";
import { availableOf, reservedBy } from "@/server/catalog/stock";
import { getSetAdmin } from "@/server/catalog/sets";
import { poolDb } from "@/server/db/pool";

export async function generateMetadata({ params }: PageProps<"/admin/products/sets/[id]">) {
  const id = Number((await params).id);
  const s = Number.isInteger(id) && id > 0 ? await getSetAdmin(id) : null;
  return { title: s ? s.set.name : "Discovery set" };
}

export default async function SetPage({ params }: PageProps<"/admin/products/sets/[id]">) {
  await requireAdmin("products.manage");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const data = await getSetAdmin(id);
  if (!data) notFound();
  const { set, pack } = data;
  const held = pack ? ((await reservedBy(poolDb(), [pack.id])).get(pack.id) ?? 0) : 0;

  return (
    <>
      <Link
        href="/admin/products#sets"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeftIcon className="size-4" /> Products
      </Link>
      <PageHeader
        title={set.name}
        description={
          <span className="flex items-center gap-2">
            <Badge variant={set.published ? "success" : "neutral"}>
              {set.published ? "On the shop" : "Hidden"}
            </Badge>
            <span>Discovery set · /discovery#{set.slug}</span>
          </span>
        }
        actions={
          set.published ? (
            <Button variant="outline" asChild>
              <a href={`/discovery#${set.slug}`} target="_blank" rel="noreferrer">
                View on the shop <ExternalLinkIcon />
              </a>
            </Button>
          ) : null
        }
      />
      <div className="flex flex-col gap-6">
        <SetDetailsCard
          id={set.id}
          initial={{
            name: set.name,
            tagline: set.tagline,
            story: set.story,
            imageAlt: set.imageAlt,
            sortOrder: set.sortOrder,
            published: set.published,
          }}
        />
        <SetContentsCard id={set.id} initial={data.fragranceIds} choices={data.library} />
        {pack && (
          <SetPackCard
            id={set.id}
            pack={{
              sku: pack.sku,
              sizeMl: pack.sizeMl,
              pieces: pack.pieces,
              pricePoisha: pack.pricePoisha,
              lowStockThreshold: pack.lowStockThreshold,
              active: pack.active,
              stock: pack.stock,
              available: availableOf(pack.stock, held),
            }}
          />
        )}
        <SetPhotoCard id={set.id} src={set.image} alt={set.imageAlt} />
      </div>
    </>
  );
}

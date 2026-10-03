import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import { BottlePhotoCard } from "@/components/admin/catalog/BottlePhotoCard";
import { DetailsForm } from "@/components/admin/catalog/DetailsForm";
import { ImagesEditor } from "@/components/admin/catalog/ImagesEditor";
import { NotesEditor } from "@/components/admin/catalog/NotesEditor";
import { SizesEditor } from "@/components/admin/catalog/SizesEditor";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";
import { requireAdmin } from "@/server/auth/session";
import { getProductAdmin } from "@/server/catalog/products";

export async function generateMetadata({ params }: PageProps<"/admin/products/[id]">) {
  const id = Number((await params).id);
  const p = Number.isInteger(id) ? await getProductAdmin(id) : null;
  return { title: p ? p.fragrance.name : "Product" };
}

const TABS = ["details", "notes", "sizes", "images"] as const;

export default async function ProductPage({
  params,
  searchParams,
}: PageProps<"/admin/products/[id]">) {
  await requireAdmin("products.manage");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const p = await getProductAdmin(id);
  if (!p) notFound();
  const tab = (await searchParams).tab;
  const initialTab = TABS.includes(tab as (typeof TABS)[number]) ? (tab as string) : "details";
  const f = p.fragrance;

  return (
    <>
      <Link
        href="/admin/products"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeftIcon className="size-4" /> Products
      </Link>
      <PageHeader
        title={f.name}
        description={
          <span className="flex items-center gap-2">
            <Badge variant={f.published ? "success" : "neutral"}>
              {f.published ? "On the shop" : "Hidden"}
            </Badge>
            <span>/fragrances/{f.slug}</span>
          </span>
        }
        actions={
          f.published ? (
            <Button variant="outline" asChild>
              <a href={`/fragrances/${f.slug}`} target="_blank" rel="noreferrer">
                View on the shop <ExternalLinkIcon />
              </a>
            </Button>
          ) : null
        }
      />
      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="sizes">Sizes and prices</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="flex flex-col gap-6">
          <DetailsForm
            id={f.id}
            initial={{
              name: f.name,
              tagline: f.tagline,
              mood: f.mood,
              story: f.story,
              bottleAlt: f.bottleAlt,
              capFinish: f.capFinish,
              palette: f.palette,
              profile: f.profile ?? null,
              sortOrder: f.sortOrder,
              published: f.published,
            }}
          />
          <BottlePhotoCard id={f.id} src={f.bottleImage} alt={f.bottleAlt} bg={f.palette.bg} />
        </TabsContent>
        <TabsContent value="notes">
          <NotesEditor
            id={f.id}
            initial={p.notes.map((n) => ({ noteSlug: n.noteSlug, layer: n.layer, label: n.label }))}
            library={p.noteLibrary}
          />
        </TabsContent>
        <TabsContent value="sizes">
          <SizesEditor fragranceId={f.id} slug={f.slug} variants={p.variants} />
        </TabsContent>
        <TabsContent value="images">
          <ImagesEditor
            fragranceId={f.id}
            images={p.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt }))}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

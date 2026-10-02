import { notFound } from "next/navigation";
import { getFragrance, getFragrances } from "@/db/queries";
import { OG_SIZE, fragranceOgImage } from "@/lib/og";

export const alt = "A ZALFI eau de parfum bottle in its world";
export const size = OG_SIZE;
export const contentType = "image/png";

export async function generateStaticParams() {
  return (await getFragrances()).map((f) => ({ slug: f.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = await getFragrance(slug);
  if (!f) notFound();
  return fragranceOgImage(f);
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BottleImage, bottleAspect } from "@/components/media/BottleImage";
import { StageAnchor } from "@/components/stage/StageAnchor";
import { getFragrances } from "@/db/queries";

export const metadata: Metadata = { title: "Stage lab", robots: { index: false, follow: false } };

/** Internal: one relit bottle in its world. Move the pointer to move the key light. */
export default async function StageLab({ searchParams }: PageProps<"/lab/stage">) {
  if (process.env.VERCEL_ENV === "production") notFound();
  const { slug = "reva" } = await searchParams;
  const all = await getFragrances();
  const f = all.find((x) => x.slug === slug) ?? all[0];
  return (
    <main
      id="main"
      className="world-surface px-gutter grid min-h-svh grid-cols-12 items-center gap-4"
      style={
        {
          "--world-bg": f.palette.bg,
          color: f.palette.ink,
        } as React.CSSProperties
      }
    >
      <div className="col-span-12 md:col-span-3">
        <p className="eyebrow opacity-70">Stage lab</p>
        <h1 className="font-display text-headline mt-4">{f.name}</h1>
        <ul className="mt-8 flex flex-wrap gap-4 md:flex-col md:gap-2">
          {all.map((x) => (
            <li key={x.slug}>
              <Link
                href={`/lab/stage?slug=${x.slug}`}
                className="eyebrow border-b border-current/30"
              >
                {x.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <StageAnchor
        kind="product"
        slug={f.slug}
        className="relative col-span-12 mx-auto h-[72svh] md:col-span-6"
        style={{ aspectRatio: bottleAspect(f.slug) }}
      >
        <div data-stage-fallback={f.slug} className="absolute inset-0">
          <BottleImage fragrance={f} fit="trim" sizes="36vw" preload />
        </div>
      </StageAnchor>
    </main>
  );
}

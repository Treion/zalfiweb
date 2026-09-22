import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { BottleImage } from "@/components/media/BottleImage";
import { NoteImage } from "@/components/media/NoteImage";
import { BOTTLE_META } from "@/components/stage/bottle-meta";
import { FRAGRANCES, NOTES } from "@/db/seed-data";
import { availability } from "@/lib/assets";
import { NOTE_LAYERS, notesByLayer, type Palette } from "@/lib/fragrance";

export const metadata: Metadata = { title: "Lab", robots: { index: false, follow: false } };

/**
 * Internal review page: design foundations, the six worlds, baked lighting maps, and asset status.
 * It is hidden on the production deployment. Vercel previews and local dev can see it.
 */
export default function LabPage() {
  if (process.env.VERCEL_ENV === "production") notFound();

  const noteAvail = availability(NOTES.map((n) => n.image));
  const missing = NOTES.filter((n) => !noteAvail[n.image]).length;

  return (
    <main id="main" className="bg-noir text-bone">
      <header className="px-gutter grid min-h-[80svh] grid-cols-12 items-end gap-x-4 pt-32 pb-16">
        <p className="eyebrow text-bone-dim col-span-12 mb-auto md:col-span-3">
          Lab / Foundations · M0
        </p>
        <Logo className="col-span-12 w-full max-w-5xl md:col-span-9 md:col-start-4" />
      </header>

      {/* Type */}
      <section aria-labelledby="type" className="border-bone/10 px-gutter border-t py-24">
        <h2 id="type" className="eyebrow text-bone-dim mb-16">
          Typography: Bodoni Moda / Hanken Grotesk
        </h2>
        <p className="font-display text-mega">Oudor</p>
        <p className="display-italic text-display text-bone-dim -mt-[0.4em] ml-[18vw]">
          smoke &amp; gold
        </p>
        <div className="mt-20 grid gap-12 md:grid-cols-12">
          <p className="font-display text-headline md:col-span-7">
            Six worlds in smoked glass. Each one a place you can wear.
          </p>
          <p className="text-bone-dim max-w-sm md:col-span-4 md:col-start-9">
            Body copy is set in Hanken Grotesk: restrained, quiet, and there to make the display
            type louder. Short lines, generous leading, never centred by default.
          </p>
        </div>
        <div className="mt-16 flex flex-wrap gap-6">
          <a href="#worlds" className="eyebrow border-bone/40 border-b pb-1" data-cursor="View">
            Hover: labelled cursor
          </a>
          <button type="button" className="eyebrow border-bone/40 border-b pb-1">
            Hover: link cursor
          </button>
        </div>
      </section>

      {/* Worlds */}
      <div id="worlds">
        {FRAGRANCES.map((f, i) => {
          const meta = BOTTLE_META[f.slug];
          return (
            <section
              key={f.slug}
              aria-labelledby={`w-${f.slug}`}
              className="px-gutter relative grid grid-cols-12 gap-x-4 gap-y-12 overflow-hidden py-24"
              style={
                {
                  "--world-bg": f.palette.bg,
                  "--world-deep": f.palette.deep,
                  "--world-accent": f.palette.accent,
                  "--world-ink": f.palette.ink,
                  background: "var(--world-bg)",
                  color: "var(--world-ink)",
                } as React.CSSProperties
              }
            >
              <div className="col-span-12 md:col-span-5">
                <p className="eyebrow opacity-70">
                  {String(i + 1).padStart(2, "0")} · {f.mood}
                </p>
                <h2 id={`w-${f.slug}`} className="font-display text-display mt-6">
                  {f.name}
                </h2>
                <p className="display-italic mt-4 max-w-md text-2xl leading-snug">{f.tagline}</p>
                <p className="mt-6 max-w-md text-sm opacity-80">{f.story}</p>
                <Swatches palette={f.palette} />
                <dl className="mt-10 grid max-w-md grid-cols-3 gap-6">
                  {NOTE_LAYERS.map((layer) => (
                    <div key={layer}>
                      <dt className="eyebrow opacity-60">{layer}</dt>
                      {notesByLayer(f, layer).map((n) => (
                        <dd key={n.slug} className="mt-2 text-sm leading-snug">
                          {n.label}
                        </dd>
                      ))}
                    </div>
                  ))}
                </dl>
              </div>

              <div className="col-span-12 md:col-span-4">
                <BottleImage
                  fragrance={f}
                  sizes="(min-width: 768px) 33vw, 100vw"
                  preload={i === 0}
                />
              </div>

              <div className="col-span-12 flex gap-3 md:col-span-3 md:flex-col">
                <p className="eyebrow opacity-60">
                  Baked maps · {meta.capShape} cap · shoulder {Math.round(meta.shoulder * 100)}%
                </p>
                {(["normal", "mask"] as const).map((k) => (
                  <Image
                    key={k}
                    src={`/images/bottles/maps/${f.slug}-${k}.webp`}
                    alt={`${f.name} ${k} map`}
                    width={meta.trim.w}
                    height={meta.trim.h}
                    sizes="(min-width: 768px) 12vw, 30vw"
                    className="h-auto w-1/3 bg-black/20 md:w-2/3"
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Note images */}
      <section aria-labelledby="notes" className="border-bone/10 px-gutter border-t py-24">
        <h2 id="notes" className="eyebrow text-bone-dim mb-4">
          Note images · {NOTES.length - missing}/{NOTES.length} supplied
        </h2>
        <p className="text-bone-dim mb-12 max-w-xl text-sm">
          Missing images render as an empty frame with the exact filename expected in
          public/images/notes/. See NOTES_IMAGES_CHECKLIST.md.
        </p>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {NOTES.map((n) => (
            <li key={n.slug}>
              <NoteImage
                note={n}
                available={noteAvail[n.image]}
                sizes="(min-width: 1024px) 14vw, 45vw"
              />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Swatches({ palette }: { palette: Palette }) {
  return (
    <ul className="mt-10 flex gap-2" aria-label="Palette">
      {(Object.entries(palette) as [keyof Palette, string][]).map(([k, v]) => (
        <li key={k} className="flex flex-col gap-2">
          <span
            className="block size-10 border border-current/20"
            style={{ background: v }}
            aria-hidden
          />
          <span className="font-mono text-[10px] opacity-70">
            {k}
            <br />
            {v}
          </span>
        </li>
      ))}
    </ul>
  );
}

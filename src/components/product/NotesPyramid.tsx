import { NoteImage } from "@/components/media/NoteImage";
import { NOTE_LAYERS, notesByLayer, type Fragrance, type NoteLayer } from "@/lib/fragrance";

const COPY: Record<NoteLayer, { label: string; hint: string }> = {
  top: { label: "Top", hint: "The first minutes" },
  heart: { label: "Heart", hint: "The hours after" },
  base: { label: "Base", hint: "What stays on skin" },
};

/** The notes pyramid: three tiers, each with real ingredient images (or their empty frames). */
export function NotesPyramid({
  fragrance,
  noteAvail,
}: {
  fragrance: Fragrance;
  noteAvail: Record<string, boolean>;
}) {
  return (
    <section aria-labelledby="pyramid-title">
      <h2 id="pyramid-title" className="eyebrow mb-8 opacity-70">
        The composition
      </h2>
      <ol className="divide-y divide-current/15 border-y border-current/15">
        {NOTE_LAYERS.map((layer) => (
          <li key={layer} className="grid grid-cols-12 gap-4 py-7">
            <div className="col-span-12 sm:col-span-3">
              <p className="font-display text-3xl leading-none">{COPY[layer].label}</p>
              <p className="mt-2 text-xs opacity-60">{COPY[layer].hint}</p>
            </div>
            <ul className="col-span-12 grid grid-cols-3 gap-4 sm:col-span-9">
              {notesByLayer(fragrance, layer).map((n) => (
                <li key={n.slug}>
                  <NoteImage
                    note={n}
                    available={noteAvail[n.image]}
                    frameLabel={false}
                    sizes="(min-width: 768px) 9vw, 28vw"
                  />
                  <p className="display-italic mt-3 text-base leading-tight">{n.label}</p>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}

"use client";

import Link from "next/link";
import clsx from "clsx";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useCart } from "@/components/cart/cart-store";
import { BottleImage } from "@/components/media/BottleImage";
import {
  filterCount,
  filtersToQuery,
  matches,
  parseFilters,
  type CollectionFilters,
} from "@/lib/collection";
import { MOMENTS, SEASONS, notesByLayer, type Fragrance } from "@/lib/fragrance";
import { formatPrice } from "@/lib/money";
import { countWord } from "@/lib/words";

type NoteOption = { slug: string; name: string };

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/**
 * All fragrances, with filters kept in the address bar (so a filtered view can be shared or
 * bookmarked). Choosing a filter changes the list at once: nothing slides or animates.
 */
export function CollectionBrowser({
  fragrances,
  notes,
}: {
  fragrances: Fragrance[];
  notes: NoteOption[];
}) {
  const params = useSearchParams();
  const pathname = usePathname();
  const filters = useMemo(
    () =>
      parseFilters(
        params,
        notes.map((n) => n.slug),
      ),
    [params, notes],
  );
  const shown = fragrances.filter((f) => matches(f, filters));

  // Each click reads the address as it is now (two quick clicks never lose one), then updates it in
  // place: Next keeps useSearchParams in step with history.replaceState
  const replace = (query: string) => window.history.replaceState(null, "", `${pathname}${query}`);
  function toggle<K extends keyof CollectionFilters>(key: K, value: CollectionFilters[K][number]) {
    const now = parseFilters(
      new URLSearchParams(window.location.search),
      notes.map((n) => n.slug),
    );
    const list = now[key] as string[];
    replace(
      filtersToQuery({
        ...now,
        [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
      }),
    );
  }
  const clear = () => replace("");
  const active = filterCount(filters);

  return (
    <>
      <section aria-label="Filters" className="border-noir/15 border-y py-6">
        <div className="grid gap-6 md:grid-cols-[1fr_1fr_auto] md:items-start">
          <ChipGroup label="Wear it">
            {MOMENTS.map((m) => (
              <Chip
                key={m}
                on={filters.wear.includes(m)}
                onClick={() => toggle("wear", m)}
                label={cap(m)}
              />
            ))}
          </ChipGroup>
          <ChipGroup label="Season">
            {SEASONS.map((s) => (
              <Chip
                key={s}
                on={filters.season.includes(s)}
                onClick={() => toggle("season", s)}
                label={cap(s)}
              />
            ))}
          </ChipGroup>
          <p className="text-smoke text-sm md:pt-7 md:text-right" aria-live="polite">
            {active
              ? `${countWord(shown.length, true)} of ${countWord(fragrances.length)}`
              : `${countWord(fragrances.length, true)} fragrances`}
            {active > 0 && (
              <button
                type="button"
                onClick={clear}
                className="text-noir border-noir/40 ml-4 border-b"
              >
                Clear
              </button>
            )}
          </p>
        </div>
        <details className="group mt-6" open={filters.note.length > 0 || undefined}>
          <summary className="eyebrow text-smoke cursor-pointer list-none">
            By note
            {filters.note.length > 0 && ` · ${filters.note.length} chosen`}
            <span aria-hidden className="ml-2 inline-block group-open:hidden">
              +
            </span>
            <span aria-hidden className="ml-2 hidden group-open:inline-block">
              −
            </span>
          </summary>
          <div className="mt-4 flex flex-wrap gap-2">
            {notes.map((n) => (
              <Chip
                key={n.slug}
                on={filters.note.includes(n.slug)}
                onClick={() => toggle("note", n.slug)}
                label={n.name}
              />
            ))}
          </div>
        </details>
      </section>

      {shown.length ? (
        <FragranceList fragrances={shown} />
      ) : (
        <p className="font-display py-24 text-3xl">
          Nothing yet. Try fewer filters.{" "}
          <button type="button" onClick={clear} className="display-italic border-b border-current">
            Show all
          </button>
        </p>
      )}
    </>
  );
}

function ChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <p className="eyebrow text-smoke">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={clsx(
        "border px-3 py-1.5 text-sm transition-colors",
        on ? "bg-noir text-bone border-noir" : "border-noir/25 hover:border-noir",
      )}
    >
      {label}
    </button>
  );
}

/** The fragrances themselves: also the server-rendered view before the filters are read */
export function FragranceList({ fragrances }: { fragrances: Fragrance[] }) {
  const { add } = useCart();
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-16 pt-12 md:grid-cols-3 md:gap-x-10 md:pt-16 md:[&>li:nth-child(3n+2)]:mt-24">
      {fragrances.map((f) => {
        const v = f.variants[0];
        const top = notesByLayer(f, "top")
          .map((n) => n.label)
          .slice(0, 2);
        const soldOut = !!v && v.stock <= 0;
        return (
          <li key={f.slug}>
            <Link
              href={`/fragrances/${f.slug}`}
              data-cursor="Discover"
              className="group block"
              aria-label={`${f.name}: ${f.tagline}`}
            >
              <span className="block transition-transform duration-700 ease-(--ease-cinema) group-hover:-translate-y-1.5">
                <BottleImage fragrance={f} sizes="(min-width: 768px) 28vw, 45vw" />
              </span>
              <span className="font-display mt-6 block text-[clamp(1.75rem,3vw,3rem)] leading-none">
                {f.name}
              </span>
              <span className="display-italic text-smoke mt-2 block">{f.mood}</span>
              {top.length > 0 && (
                <span className="mt-3 block text-sm leading-snug">{top.join(" · ")}</span>
              )}
            </Link>
            {v && (
              <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-2">
                <span className="tabular-nums">{formatPrice(v.pricePoisha)}</span>
                <button
                  type="button"
                  disabled={soldOut}
                  data-cursor="Add"
                  aria-label={soldOut ? `${f.name}: sold out` : `Add ${f.name} to bag`}
                  onClick={() =>
                    add({
                      sku: v.sku,
                      slug: f.slug,
                      name: f.name,
                      sizeMl: v.sizeMl,
                      pricePoisha: v.pricePoisha,
                      bottleImage: f.bottleImage,
                    })
                  }
                  className="eyebrow border-noir/40 hover:border-noir border-b pb-0.5 transition-colors disabled:opacity-40"
                >
                  {soldOut ? "Sold out" : "Add"}
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

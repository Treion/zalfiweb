"use client";

import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useCart } from "@/components/cart/cart-store";
import { BottleImage } from "@/components/media/BottleImage";
import { Stars } from "@/components/product/Stars";
import {
  SORTS,
  SORT_LABELS,
  filterCount,
  filtersToQuery,
  matches,
  parseFilters,
  parseSort,
  queryWithSort,
  sortFragrances,
  type CollectionFilters,
  type Ratings,
  type Sort,
} from "@/lib/collection";
import { BADGE_LABELS, MOMENTS, SEASONS, notesByLayer, type Fragrance } from "@/lib/fragrance";
import { formatPrice } from "@/lib/money";
import { countWord } from "@/lib/words";

type NoteOption = { slug: string; name: string };

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/**
 * All fragrances, with filters and a sort kept in the address bar (so a view can be shared or
 * bookmarked). Choosing one changes the list at once: nothing slides or animates.
 */
export function CollectionBrowser({
  fragrances,
  notes,
  ratings = {},
}: {
  fragrances: Fragrance[];
  notes: NoteOption[];
  /** Approved reviews per fragrance: stars on the cards, and "Top rated" */
  ratings?: Ratings;
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
  const sort = parseSort(params);
  const shown = sortFragrances(
    fragrances.filter((f) => matches(f, filters)),
    sort,
    ratings,
  );
  const sorts = SORTS.filter((s) => s !== "rating" || Object.keys(ratings).length > 0);

  // Each click reads the address as it is now (two quick clicks never lose one), then updates it in
  // place: Next keeps useSearchParams in step with history.replaceState
  const replace = (query: string) => window.history.replaceState(null, "", `${pathname}${query}`);
  const current = () => {
    const q = new URLSearchParams(window.location.search);
    return {
      filters: parseFilters(
        q,
        notes.map((n) => n.slug),
      ),
      sort: parseSort(q),
    };
  };
  function toggle<K extends keyof CollectionFilters>(key: K, value: CollectionFilters[K][number]) {
    const now = current();
    const list = now.filters[key] as string[];
    replace(
      queryWithSort(
        filtersToQuery({
          ...now.filters,
          [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
        }),
        now.sort,
      ),
    );
  }
  // Clear takes the filters away and keeps the order
  const clear = () => replace(queryWithSort("", current().sort));
  const setSort = (next: Sort) => replace(queryWithSort(filtersToQuery(current().filters), next));
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
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3 md:flex-col md:items-end md:pt-7">
            <p className="text-smoke text-sm md:text-right" aria-live="polite">
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
            <label className="flex items-baseline gap-2 text-sm">
              <span className="eyebrow text-smoke">Sort</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="border-noir/30 focus:border-noir cursor-pointer appearance-none border-b bg-transparent pr-4 pb-0.5 outline-none"
              >
                {sorts.map((s) => (
                  <option key={s} value={s}>
                    {SORT_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>
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
        <FragranceList fragrances={shown} ratings={ratings} />
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

/**
 * The fragrances themselves: also the server-rendered view before the filters are read. Pointing
 * at a card (on a device that can hover) fades in its first photo from Products → Photos.
 */
export function FragranceList({
  fragrances,
  ratings = {},
}: {
  fragrances: Fragrance[];
  ratings?: Ratings;
}) {
  const { add } = useCart();
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-16 pt-12 md:grid-cols-3 md:gap-x-10 md:pt-16 md:[&>li:nth-child(3n+2)]:mt-24">
      {fragrances.map((f) => {
        const v = f.variants[0];
        const top = notesByLayer(f, "top")
          .map((n) => n.label)
          .slice(0, 2);
        const soldOut = !!v && v.stock <= 0;
        const photo = f.images[0];
        const rating = ratings[f.slug];
        return (
          <li key={f.slug}>
            <Link href={`/fragrances/${f.slug}`} data-cursor="Discover" className="group block">
              <span className="relative block transition-transform duration-700 ease-(--ease-cinema) group-hover:-translate-y-1.5">
                <BottleImage fragrance={f} sizes="(min-width: 768px) 28vw, 45vw" />
                {photo && (
                  // Hover devices only: on touch it's never loaded (display: none)
                  <span className="absolute inset-0 hidden opacity-0 transition-opacity duration-700 ease-(--ease-cinema) group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:hover)]:block">
                    <Image
                      src={photo.url}
                      alt=""
                      fill
                      sizes="(min-width: 768px) 28vw, 45vw"
                      className="object-cover"
                    />
                  </span>
                )}
                {f.badge && (
                  <span className="eyebrow bg-bone border-noir/25 absolute top-0 left-0 border px-2 py-1">
                    {BADGE_LABELS[f.badge]}
                  </span>
                )}
              </span>
              <span className="font-display mt-6 block text-[clamp(1.75rem,3vw,3rem)] leading-none">
                {f.name}
              </span>
              <span className="display-italic text-smoke mt-2 block">{f.mood}</span>
              {rating && (
                <span className="mt-2 flex items-center gap-2 text-sm">
                  <Stars rating={rating.average} label={false} />
                  <span aria-hidden className="text-smoke tabular-nums">
                    ({rating.count})
                  </span>
                  <span className="sr-only">
                    {`${rating.average} out of 5, ${rating.count} ${rating.count === 1 ? "review" : "reviews"}`}
                  </span>
                </span>
              )}
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

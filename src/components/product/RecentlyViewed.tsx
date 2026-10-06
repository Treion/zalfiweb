"use client";

import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";
import { useEffect, useSyncExternalStore } from "react";
import { formatPrice } from "@/lib/money";
import type { ViewedItem } from "@/lib/viewed";

const KEY = "zalfi.viewed.v1";
const KEEP = 8;
const EMPTY: string[] = [];

// A tiny store over localStorage, read with useSyncExternalStore: the server and the first paint
// see nothing, so hydration always matches
let cache: { raw: string | null; list: string[] } = { raw: null, list: EMPTY };
const listeners = new Set<() => void>();

function snapshot() {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    /* storage blocked */
  }
  if (raw !== cache.raw) {
    let list: string[] = EMPTY;
    try {
      const v = JSON.parse(raw ?? "[]");
      if (Array.isArray(v)) list = v.filter((s): s is string => typeof s === "string");
    } catch {
      /* corrupt: start again */
    }
    cache = { raw, list };
  }
  return cache.list;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function record(slug: string) {
  try {
    const next = [slug, ...snapshot().filter((s) => s !== slug)].slice(0, KEEP);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: the rail just stays empty */
  }
  listeners.forEach((l) => l());
}

/**
 * "Recently viewed": the fragrances this visitor opened, newest first, kept on their own device
 * (nothing is sent anywhere). A product page records itself (`current`) and leaves itself out.
 * Nothing shows until there's something to show. It sits at the end of a page, so arriving after
 * the page has loaded moves nothing above it. Ink and hairlines follow the page around it.
 */
export function RecentlyViewed({
  items,
  current,
  className,
}: {
  items: ViewedItem[];
  current?: string;
  className?: string;
}) {
  const slugs = useSyncExternalStore(subscribe, snapshot, () => EMPTY).filter((s) => s !== current);
  useEffect(() => {
    if (current) record(current);
  }, [current]);

  const shown = slugs
    .map((s) => items.find((i) => i.slug === s))
    .filter((i): i is ViewedItem => !!i)
    .slice(0, 6);
  if (!shown.length) return null;

  return (
    <section
      aria-labelledby="viewed-title"
      className={clsx("border-t border-current/15 pt-8", className)}
    >
      <h2 id="viewed-title" className="eyebrow opacity-70">
        Recently viewed
      </h2>
      <ul className="mt-6 flex snap-x [scrollbar-width:thin] gap-6 overflow-x-auto pb-2">
        {shown.map((f) => (
          <li key={f.slug} className="w-32 shrink-0 snap-start md:w-40">
            <Link href={`/fragrances/${f.slug}`} className="group block">
              <span className="relative block aspect-square">
                <Image
                  src={f.image}
                  alt=""
                  fill
                  quality={90}
                  sizes="160px"
                  className="object-contain transition-transform duration-700 ease-(--ease-cinema) group-hover:-translate-y-1"
                />
              </span>
              <span className="font-display mt-3 block text-xl leading-none">{f.name}</span>
              <span className="mt-1 block text-sm opacity-70">
                {f.pricePoisha !== null ? formatPrice(f.pricePoisha) : f.mood}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

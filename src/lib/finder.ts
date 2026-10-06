/**
 * "Find your world": three questions, answered on instinct, each option leaning towards one or
 * two of the six worlds. Pure data plus one pure function, so it runs anywhere and is easy to tune.
 */
import type { Fragrance } from "./fragrance";

export type FinderOption = { label: string; weights: Partial<Record<string, number>> };
export type FinderQuestion = { prompt: string; hint: string; options: FinderOption[] };

export const QUESTIONS: FinderQuestion[] = [
  {
    prompt: "Pick a place to disappear to.",
    hint: "Where the scent begins.",
    options: [
      { label: "A frozen field at first light", weights: { reva: 3, riven: 1 } },
      { label: "A glasshouse after the rain", weights: { riven: 3, maree: 1 } },
      { label: "A garden that runs into the sea", weights: { maree: 3, solea: 1 } },
      { label: "Hot sand, late afternoon", weights: { solea: 3, maree: 1 } },
      { label: "A tailor's room after hours", weights: { bond: 3, oudor: 1 } },
      { label: "A velvet room, candles low", weights: { oudor: 3, bond: 1 } },
    ],
  },
  {
    prompt: "What do you reach for first?",
    hint: "How it sits on skin.",
    options: [
      { label: "Cool moss and bark", weights: { reva: 2, riven: 1 } },
      { label: "Cold glass", weights: { riven: 2, reva: 1 } },
      { label: "Sun-warm linen", weights: { maree: 2, solea: 1 } },
      { label: "Bare skin", weights: { solea: 2, oudor: 1 } },
      { label: "Dark wool, cut close", weights: { bond: 2, oudor: 1 } },
      { label: "Velvet and smoke", weights: { oudor: 2, bond: 1 } },
    ],
  },
  {
    prompt: "When will you wear it?",
    hint: "The light it wants.",
    options: [
      { label: "Morning, windows open", weights: { reva: 2, riven: 2 } },
      { label: "A long afternoon", weights: { maree: 2, solea: 2 } },
      { label: "Evening, dressed up", weights: { bond: 2, maree: 1 } },
      { label: "Late, then later", weights: { oudor: 2, bond: 1 } },
    ],
  },
];

/**
 * The world that best matches the answers (one option index per question). Ties go to the place
 * chosen first (question one weighs most on instinct), then to the collection's own order.
 */
export function recommend<F extends Pick<Fragrance, "slug" | "sortOrder">>(
  answers: number[],
  fragrances: F[],
): F {
  const score = new Map(fragrances.map((f) => [f.slug, 0]));
  const first = new Map(fragrances.map((f) => [f.slug, 0]));
  answers.forEach((a, qi) => {
    for (const [slug, n = 0] of Object.entries(QUESTIONS[qi]?.options[a]?.weights ?? {})) {
      if (!score.has(slug)) continue;
      score.set(slug, score.get(slug)! + n);
      if (qi === 0) first.set(slug, n);
    }
  });
  return [...fragrances].sort(
    (a, b) =>
      score.get(b.slug)! - score.get(a.slug)! ||
      first.get(b.slug)! - first.get(a.slug)! ||
      a.sortOrder - b.sortOrder,
  )[0];
}

type Kin = Pick<Fragrance, "slug" | "sortOrder" | "profile" | "notes">;

/**
 * The fragrances closest to this one, for "Similar worlds" on its page: shared moments weigh most
 * (when you'd wear it), then shared notes, then shared seasons. Ties go to the nearest in the
 * collection's order. Pure, so the choice is predictable and testable.
 */
export function similarWorlds<F extends Kin>(f: F, all: F[], count = 2): F[] {
  const notes = new Set(f.notes.map((n) => n.slug));
  const moments = new Set(f.profile?.moments ?? []);
  const seasons = new Set(f.profile?.seasons ?? []);
  const score = (o: F) =>
    (o.profile?.moments ?? []).filter((m) => moments.has(m)).length * 3 +
    new Set(o.notes.map((n) => n.slug).filter((s) => notes.has(s))).size * 2 +
    (o.profile?.seasons ?? []).filter((s) => seasons.has(s)).length;
  return all
    .filter((o) => o.slug !== f.slug)
    .map((o) => ({ o, s: score(o), d: Math.abs(o.sortOrder - f.sortOrder) }))
    .sort((a, b) => b.s - a.s || a.d - b.d || a.o.sortOrder - b.o.sortOrder)
    .slice(0, count)
    .map((x) => x.o);
}

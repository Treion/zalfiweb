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

import { z } from "zod";

/**
 * Reviews from verified buyers: what a customer sends, how it's signed, and the summary a product
 * page shows. Pure, so the order page, the API and the tests share it.
 */
export const REVIEW_BODY_MAX = 600;
export const REVIEW_NAME_MAX = 40;

export const reviewInputSchema = z
  .object({
    /** The order's access token: only its buyer has it */
    token: z.string().regex(/^[A-Za-z0-9_-]{20,64}$/),
    itemId: z.number().int().positive(),
    rating: z.number().int().min(1, "Choose a rating.").max(5),
    body: z
      .string()
      .trim()
      .max(REVIEW_BODY_MAX, `Keep it under ${REVIEW_BODY_MAX} characters.`)
      .transform((v) => v.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n")),
    name: z.string().trim().min(1, "Add how to sign it.").max(REVIEW_NAME_MAX),
  })
  .strict();

export type ReviewInput = z.input<typeof reviewInputSchema>;

/** How a review is signed unless the buyer changes it: first name and an initial ("Nusrat J.") */
export function signatureOf(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  const [first, ...rest] = parts;
  const last = rest.at(-1);
  return last ? `${first} ${last[0]!.toUpperCase()}.` : first!;
}

/** A review as the shop shows it */
export type PublicReview = {
  id: number;
  rating: number;
  body: string;
  name: string;
  /** ISO date it was written */
  date: string;
  reply: string | null;
};

export type ReviewSummary = { average: number; count: number; reviews: PublicReview[] };

/** The average to one decimal, as it's read aloud and shown ("4.7") */
export function averageOf(ratings: number[]) {
  if (!ratings.length) return 0;
  return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
}

/** "4.7 out of 5, from 12 reviews" */
export function ratingLabel(average: number, count: number) {
  return `${average.toFixed(1)} out of 5, from ${count} ${count === 1 ? "review" : "reviews"}`;
}

import { z } from "zod";
import { getDb } from "@/db/client";
import { newsletterSignups } from "@/db/schema";

// Edge-portable: Web APIs + Neon's fetch-based driver only. (Next 16 deprecates
// `runtime = "edge"`; on Vercel this runs on Fluid compute. Re-add the export to pin it to edge.)

const Body = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  consent: z.literal(true),
  source: z.string().max(40).optional(),
  /** Honeypot: humans never see or fill this field */
  company: z.string().max(0).optional(),
});

export type NewsletterResult =
  | { status: "subscribed" }
  | { status: "already" }
  | { status: "invalid"; message: string }
  | { status: "unavailable" };

const json = (body: NewsletterResult, status = 200) => Response.json(body, { status });

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ status: "invalid", message: "Malformed request." }, 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === "company") return json({ status: "subscribed" }); // silently drop bots
    const message =
      field === "consent"
        ? "Please confirm you'd like to hear from us."
        : "That email doesn't look right.";
    return json({ status: "invalid", message }, 422);
  }

  const db = getDb();
  if (!db) return json({ status: "unavailable" }, 503);

  try {
    const inserted = await db
      .insert(newsletterSignups)
      .values({ email: parsed.data.email, source: parsed.data.source ?? "site", consent: true })
      .onConflictDoNothing({ target: newsletterSignups.email })
      .returning({ id: newsletterSignups.id });
    return json(
      { status: inserted.length ? "subscribed" : "already" },
      inserted.length ? 201 : 200,
    );
  } catch (err) {
    console.error("[newsletter]", (err as Error).message);
    return json({ status: "unavailable" }, 503);
  }
}

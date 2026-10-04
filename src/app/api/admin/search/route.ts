import { getAdmin } from "@/server/auth/session";
import { globalSearch } from "@/server/search";

export const dynamic = "force-dynamic";

/** Suggestions for the top bar's search box: ?q=… → the first few hits per group */
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return new Response("Sign in", { status: 401 });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const groups = await globalSearch(q, admin.can, 4);
  return Response.json({ q, groups }, { headers: { "Cache-Control": "private, no-store" } });
}

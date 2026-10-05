import { readUpload } from "@/server/providers/storage";

// Serves files the admin uploaded: from local storage (.data/uploads), or from Netlify Blobs on
// Netlify. With Vercel Blob, files are served from Blob's own URLs and this route isn't used.
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  png: "image/png",
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  avif: "image/avif",
};

export async function GET(_req: Request, ctx: RouteContext<"/media/[...path]">) {
  const { path } = await ctx.params;
  const key = path.join("/");
  const type = TYPES[key.split(".").pop()?.toLowerCase() ?? ""];
  if (!type) return new Response("Not found", { status: 404 });
  try {
    const body = await readUpload(key);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": type,
        // Keys carry a content hash: a URL never changes meaning
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

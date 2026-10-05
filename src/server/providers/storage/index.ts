import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

/**
 * Where uploaded files (product photos, bottle maps, set boxes) live, behind one interface:
 *  - local (default): .data/uploads on this machine, served at /media/… (development)
 *  - blob: Vercel Blob, used whenever BLOB_READ_WRITE_TOKEN is set (Vercel adds it with its Blob storage)
 *  - netlify: Netlify Blobs, on Netlify (it needs no keys), served at /media/… like local files
 * Keys always contain a content hash, so a URL never changes meaning and can be cached forever.
 */
export interface StorageProvider {
  readonly name: "local" | "blob" | "netlify";
  put(key: string, body: Buffer, contentType: string): Promise<{ url: string }>;
  remove(url: string): Promise<void>;
}

export const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");
const safeKey = (key: string) => {
  const clean = path.posix.normalize(key).replace(/^(\.\.(\/|$))+/, "");
  if (clean.startsWith("/") || clean.includes("..")) throw new Error("Invalid storage key");
  return clean;
};

export const localStorage: StorageProvider = {
  name: "local",
  async put(key, body) {
    const k = safeKey(key);
    const file = path.join(UPLOAD_DIR, k);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return { url: `/media/${k}` };
  },
  async remove(url) {
    if (!url.startsWith("/media/")) return;
    await unlink(path.join(UPLOAD_DIR, safeKey(url.slice("/media/".length)))).catch(() => {});
  },
};

/** The Netlify Blobs store for uploads (site-wide, so files outlive each deploy) */
async function netlifyStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: "uploads", consistency: "strong" });
}

const netlifyStorage: StorageProvider = {
  name: "netlify",
  async put(key, body, contentType) {
    const k = safeKey(key);
    const store = await netlifyStore();
    await store.set(k, new Uint8Array(body).buffer, { metadata: { contentType } });
    return { url: `/media/${k}` };
  },
  async remove(url) {
    if (!url.startsWith("/media/")) return;
    const store = await netlifyStore();
    await store.delete(safeKey(url.slice("/media/".length))).catch(() => {});
  },
};

/** Running on Netlify: its runtime hands Netlify Blobs its context (UPLOAD_STORAGE=netlify forces it) */
export const onNetlify = () =>
  env("UPLOAD_STORAGE") === "netlify" ||
  !!env("NETLIFY_BLOBS_CONTEXT") ||
  !!(globalThis as { netlifyBlobsContext?: unknown }).netlifyBlobsContext ||
  env("NETLIFY") === "true";

/** Reads an uploaded file for the /media route: from Netlify Blobs on Netlify, else from disk */
export async function readUpload(key: string): Promise<Buffer> {
  const k = safeKey(key);
  if (onNetlify()) {
    const data = await (await netlifyStore()).get(k, { type: "arrayBuffer" });
    if (data) return Buffer.from(data);
    // Files uploaded before the move to Netlify, or shipped with the site, may still be on disk
  }
  return readFile(path.join(UPLOAD_DIR, k));
}

function blobStorage(token: string): StorageProvider {
  return {
    name: "blob",
    async put(key, body, contentType) {
      const { put } = await import("@vercel/blob");
      const res = await put(safeKey(key), body, {
        access: "public",
        contentType,
        token,
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 31536000,
      });
      return { url: res.url };
    },
    async remove(url) {
      if (!/^https:\/\//.test(url)) return;
      const { del } = await import("@vercel/blob");
      await del(url, { token }).catch(() => {});
    },
  };
}

/**
 * Vercel Blob whenever its token is there (Vercel's Blob integration adds it), else Netlify Blobs
 * on Netlify, else local files. No switch: a deployed site can't keep local files, and a computer
 * has neither.
 */
export function storageProvider(): StorageProvider {
  const token = env("BLOB_READ_WRITE_TOKEN");
  if (token) return blobStorage(token);
  return onNetlify() ? netlifyStorage : localStorage;
}

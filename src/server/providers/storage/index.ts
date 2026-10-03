import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

/**
 * Where uploaded files (product photos, bottle maps) live, behind one interface:
 *  - local (default): .data/uploads on this machine, served at /media/… (development)
 *  - blob: Vercel Blob, used when BLOB_READ_WRITE_TOKEN is set and Settings → Integrations picks it
 * Keys always contain a content hash, so a URL never changes meaning and can be cached forever.
 */
export interface StorageProvider {
  readonly name: "local" | "blob";
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

/** Reads a locally stored file (for the /media route) */
export async function readLocal(key: string) {
  return readFile(path.join(UPLOAD_DIR, safeKey(key)));
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

export function storageProvider(selected: "local" | "blob"): StorageProvider {
  const token = env("BLOB_READ_WRITE_TOKEN");
  return selected === "blob" && token ? blobStorage(token) : localStorage;
}

import "server-only";
import fs from "node:fs";
import path from "node:path";

const PUBLIC_DIR = path.join(process.cwd(), "public");

/** Whether a file exists under /public. Runs on the server at build/render time only. */
export function publicFileExists(publicPath: string) {
  const resolved = path.join(PUBLIC_DIR, publicPath);
  if (!resolved.startsWith(PUBLIC_DIR)) return false;
  try {
    return fs.statSync(resolved).isFile();
  } catch {
    return false;
  }
}

/** Map of image path → available, for handing to client components. */
export function availability(paths: string[]): Record<string, boolean> {
  return Object.fromEntries(paths.map((p) => [p, publicFileExists(p)]));
}

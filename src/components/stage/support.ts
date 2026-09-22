"use client";

let cached: boolean | null = null;

/** Whether this browser can run the WebGL stage. Cached, and marks <html> for the static layout. */
export function canRunStage() {
  if (cached !== null) return cached;
  try {
    const c = document.createElement("canvas");
    cached = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    cached = false;
  }
  if (!cached) document.documentElement.classList.add("static-experience");
  return cached;
}

"use client";

let cached: boolean | null = null;

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen/i;
const FORCE_KEY = "zalfi.stage.force";

/**
 * Whether this browser can run the WebGL stage at a cinematic frame rate.
 *
 * Software renderers (SwiftShader, llvmpipe, GPU blocklisted or disabled) cannot hold 60fps and
 * would block the main thread, so they get the static editorial layout instead: the same content
 * and the same photos, without the canvas. `?stage=force` overrides this for testing.
 * The result is cached, and <html> is marked for the static layout.
 */
export function canRunStage() {
  if (cached !== null) return cached;
  cached = detect();
  if (!cached) document.documentElement.classList.add("static-experience");
  return cached;
}

function detect() {
  try {
    const force = new URLSearchParams(location.search).get("stage");
    if (force === "force") sessionStorage.setItem(FORCE_KEY, "1");
    if (force === "off") sessionStorage.removeItem(FORCE_KEY);
    if (sessionStorage.getItem(FORCE_KEY)) return true;
  } catch {
    /* storage may be blocked: fall through to detection */
  }
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ??
      c.getContext("webgl", {
        failIfMajorPerformanceCaveat: true,
      })) as WebGLRenderingContext | null;
    if (!gl) return false;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return !SOFTWARE.test(renderer);
  } catch {
    return false;
  }
}

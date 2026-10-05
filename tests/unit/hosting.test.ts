import { afterEach, describe, expect, it, vi } from "vitest";
import { isLiveSite } from "@/lib/env";
import { inBackground } from "@/server/background";
import { storageProvider } from "@/server/providers/storage";
import { testProvidersAllowed } from "@/server/test-mode";

/** Hosting: the same code on a computer, on Vercel and on Netlify */
const HOST_VARS = [
  "VERCEL_ENV",
  "CONTEXT",
  "SITE_ENV",
  "BLOB_READ_WRITE_TOKEN",
  "NETLIFY",
  "NETLIFY_BLOBS_CONTEXT",
  "UPLOAD_STORAGE",
];

afterEach(() => vi.unstubAllEnvs());
const clean = () => HOST_VARS.forEach((k) => vi.stubEnv(k, ""));

describe("the live site", () => {
  it("is Vercel's or Netlify's production, or SITE_ENV=production", () => {
    clean();
    expect(isLiveSite()).toBe(false);
    vi.stubEnv("VERCEL_ENV", "production");
    expect(isLiveSite()).toBe(true);
    clean();
    vi.stubEnv("CONTEXT", "production");
    expect(isLiveSite()).toBe(true);
    clean();
    vi.stubEnv("SITE_ENV", "production");
    expect(isLiveSite()).toBe(true);
  });

  it("previews and branch deploys aren't live", () => {
    clean();
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("CONTEXT", "deploy-preview");
    expect(isLiveSite()).toBe(false);
  });

  it("never allows the test gateway and courier on the live site", () => {
    clean();
    vi.stubEnv("SITE_ENV", "production");
    vi.stubEnv("ALLOW_TEST_PROVIDERS", "true");
    expect(testProvidersAllowed()).toBe(false);
  });
});

describe("where uploads go", () => {
  it("Vercel Blob with its token, else Netlify Blobs on Netlify, else this computer", () => {
    clean();
    expect(storageProvider().name).toBe("local");
    vi.stubEnv("NETLIFY", "true");
    expect(storageProvider().name).toBe("netlify");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_x");
    expect(storageProvider().name).toBe("blob");
    clean();
    vi.stubEnv("NETLIFY_BLOBS_CONTEXT", "e30=");
    expect(storageProvider().name).toBe("netlify");
  });
});

describe("background work", () => {
  it("runs outside a request, and a failure is logged, not thrown", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    let ran = false;
    inBackground("test", async () => {
      ran = true;
    });
    inBackground("test", async () => {
      throw new Error("boom");
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(ran).toBe(true);
    expect(log).toHaveBeenCalledWith("[test]", "boom");
    log.mockRestore();
  });
});

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The security checklist, read from the source itself (docs/reference/decisions.md, 125): every
 * door the site has must show its lock. A new route or action that skips its check fails here.
 */
const ROOT = path.join(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join("/");
const files = walk(ROOT);
const read = (p: string) => readFileSync(p, "utf8");
const routes = files
  .filter((f) => f.endsWith("route.ts"))
  .map((f) => ({ f: rel(f), src: read(f) }));

/** Each exported function's body, from "export async function" to the next one */
function exportedFunctions(src: string) {
  const parts = src.split(/(?=^export async function )/m).slice(1);
  return parts.map((p) => ({ name: /export async function (\w+)/.exec(p)![1]!, body: p }));
}

describe("the security checklist, in the code", () => {
  it("runs every admin server action through runAction (session, permission, strict schema)", () => {
    const actionFiles = files.filter((f) => /^\s*"use server";/m.test(read(f)));
    expect(actionFiles.length).toBeGreaterThan(5);
    const PUBLIC = new Set(["acceptInvitationAction"]); // the invitee has no account yet
    for (const f of actionFiles)
      for (const fn of exportedFunctions(read(f))) {
        if (PUBLIC.has(fn.name)) continue;
        expect(fn.body, `${rel(f)} → ${fn.name}`).toMatch(/runAction\(/);
      }
  });

  it("gives the public invite action its own rate limit and strict schema", () => {
    const src = read(path.join(ROOT, "app/(admin)/admin/invite/[token]/actions.ts"));
    expect(src).toMatch(/hit\(`invite-accept/);
    expect(src).toMatch(/\.strict\(\)/);
  });

  it("checks the admin and their permission in every /api/admin route", () => {
    const admin = routes.filter((r) => r.f.startsWith("app/api/admin/") && !r.f.includes("/auth/"));
    expect(admin.length).toBeGreaterThan(5);
    for (const r of admin) {
      expect(r.src, r.f).toMatch(/await getAdmin\(\)/);
      expect(r.src, r.f).toMatch(/Response\("Sign in", \{ status: 401 \}\)/);
      // Search filters by permission inside; everything else checks one up front
      if (!r.f.endsWith("search/route.ts")) expect(r.src, r.f).toMatch(/\.can\("/);
    }
  });

  it("logs every CSV export in the activity log", () => {
    for (const r of routes.filter((r) => r.f.startsWith("app/api/admin/export/")))
      expect(r.src, r.f).toMatch(/csvResponse\([\s\S]*admin\.actor/);
  });

  it("protects every cron route with CRON_SECRET", () => {
    const cron = routes.filter((r) => r.f.startsWith("app/api/cron/"));
    expect(cron.length).toBe(3);
    for (const r of cron) expect(r.src, r.f).toMatch(/authorisedCron\(req\)/);
  });

  it("verifies every provider callback before acting, and acts once", () => {
    const ipn = routes.find((r) => r.f === "app/api/payments/ipn/[provider]/route.ts")!;
    expect(ipn.src).toMatch(/firstDelivery\(/);
    expect(ipn.src).toMatch(/settleNotice\(/); // validated with the provider's own API inside
    const courier = routes.find((r) => r.f === "app/api/couriers/webhook/[courier]/route.ts")!;
    expect(courier.src).toMatch(/handleCourierWebhook\(/); // signature / token / secret inside
    for (const r of routes.filter((r) => r.f.startsWith("app/api/payments/mock/")))
      expect(r.src, r.f).toMatch(/mockAllowed\(\)/);
  });

  it("rate-limits every public endpoint that sends, places or pays", () => {
    const limited = [
      "app/api/checkout/place/route.ts",
      "app/api/checkout/quote/route.ts",
      "app/api/payments/start/route.ts",
      "app/api/payments/manual/route.ts",
      "app/api/track/route.ts",
      "app/api/restock/route.ts",
    ];
    for (const f of limited) expect(routes.find((r) => r.f === f)?.src, f).toMatch(/await hit\(/);
    // The phone code: per phone and per IP (send), per IP and per code (verify)
    const otp = read(path.join(ROOT, "server/checkout/otp.ts"));
    expect(otp).toMatch(/otp-send:phone:/);
    expect(otp).toMatch(/otp-send:ip:/);
    expect(otp).toMatch(/otp-verify:ip:/);
    // Admin sign-in: per IP and per email
    const auth = read(path.join(ROOT, "server/auth/auth.ts"));
    expect(auth).toMatch(/admin-login:email:/);
  });

  it("classifies every API route, so a new one needs a decision", () => {
    const KNOWN = [
      /^app\/api\/admin\//,
      /^app\/api\/cron\//,
      /^app\/api\/checkout\/(otp|place|quote)?\/?route\.ts$/,
      /^app\/api\/couriers\/webhook\/\[courier\]\/route\.ts$/,
      /^app\/api\/payments\/(ipn|return)\/\[provider\]\/route\.ts$/,
      /^app\/api\/payments\/(start|manual)\/route\.ts$/,
      /^app\/api\/payments\/mock\//,
      /^app\/api\/stock\/route\.ts$/, // public stock counts only
      /^app\/api\/(track|restock)\/route\.ts$/, // order lookup by number + phone; "Notify me"
      /^app\/media\/\[\.\.\.path\]\/route\.ts$/, // uploaded photos, by hashed key
    ];
    for (const r of routes)
      expect(
        KNOWN.some((k) => k.test(r.f)),
        r.f,
      ).toBe(true);
  });

  it("validates every public JSON body with a strict schema", () => {
    for (const f of [
      "app/api/checkout/route.ts",
      "app/api/checkout/otp/route.ts",
      "app/api/checkout/place/route.ts",
      "app/api/checkout/quote/route.ts",
      "app/api/payments/start/route.ts",
      "app/api/payments/manual/route.ts",
      "app/api/track/route.ts",
      "app/api/restock/route.ts",
    ]) {
      const src = routes.find((r) => r.f === f)!.src;
      // A shared strict schema from src/lib/checkout.ts, read through readBody(req, schema)
      const viaShared = /readBody\(req, \w+Schema\)/.test(src) || /safeParse/.test(src);
      expect(/\.strict\(\)/.test(src) || viaShared, f).toBe(true);
    }
  });

  it("sends the security headers: everywhere, and stricter on the admin", () => {
    const next = readFileSync(path.join(process.cwd(), "next.config.ts"), "utf8");
    for (const h of [
      "X-Content-Type-Options",
      "Referrer-Policy",
      "X-Frame-Options",
      "Permissions-Policy",
    ])
      expect(next).toContain(h);
    const proxy = read(path.join(ROOT, "proxy.ts"));
    expect(proxy).toMatch(/"Cache-Control": "private, no-store/);
    expect(proxy).toMatch(/"X-Frame-Options": "DENY"/);
    expect(proxy).toMatch(/"X-Robots-Tag": "noindex/);
  });
});

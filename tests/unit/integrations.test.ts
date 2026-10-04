import { afterEach, describe, expect, it, vi } from "vitest";
import { CATALOG, resolve, shownValues } from "@/server/integrations";
import { mask, open, seal, VaultError } from "@/server/integrations/vault";

type Row = Parameters<typeof resolve>[1];
const row = (over: Partial<NonNullable<Row>> = {}): NonNullable<Row> => ({
  provider: "sslcommerz",
  enabled: null,
  mode: null,
  secrets: null,
  config: {},
  webhookToken: null,
  lastCheck: null,
  updatedBy: null,
  updatedAt: new Date(),
  ...over,
});

afterEach(() => vi.unstubAllEnvs());

describe("the key vault", () => {
  it("seals and opens a value, never in plain text", () => {
    const sealed = seal({ storePassword: "p@ss-1234" });
    expect(sealed.startsWith("v1:")).toBe(true);
    expect(sealed).not.toContain("p@ss");
    expect(open(sealed)).toEqual({ storePassword: "p@ss-1234" });
    // a fresh IV each time
    expect(seal({ a: 1 })).not.toBe(seal({ a: 1 }));
  });

  it("refuses a tampered or foreign envelope", () => {
    const [v, iv, tag, ct] = seal({ a: "b" }).split(":");
    const flipped = ct!.slice(0, -2) + (ct!.endsWith("A") ? "B" : "A") + ct!.slice(-1);
    expect(() => open([v, iv, tag, flipped].join(":"))).toThrow(VaultError);
    expect(() => open("v0:x:y:z")).toThrow(VaultError);
  });

  it("can't read what another key sealed", () => {
    const sealed = seal({ a: "b" });
    vi.stubEnv("CREDENTIALS_KEY", Buffer.alloc(32, 7).toString("base64"));
    expect(() => open(sealed)).toThrow(VaultError);
  });

  it("shows only the last four characters", () => {
    expect(mask("abcdefgh1234")).toBe("•••• 1234");
    expect(mask("short")).toBe("••••");
    expect(mask("")).toBeNull();
  });
});

describe("resolving a provider's set-up", () => {
  const ssl = CATALOG.sslcommerz;

  it("follows the environment when nothing was saved in the admin", () => {
    vi.stubEnv("SSLCOMMERZ_STORE_ID", "envstore");
    vi.stubEnv("SSLCOMMERZ_STORE_PASSWORD", "envpass");
    vi.stubEnv("SSLCOMMERZ_IS_LIVE", "true");
    const r = resolve(ssl, undefined);
    expect(r).toMatchObject({ source: "env", configured: true, enabled: true, mode: "live" });
    expect(r.values.storeId).toBe("envstore");
  });

  it("is off and unconfigured with nothing anywhere", () => {
    vi.stubEnv("SSLCOMMERZ_STORE_ID", "");
    vi.stubEnv("SSLCOMMERZ_STORE_PASSWORD", "");
    expect(resolve(ssl, undefined)).toMatchObject({
      source: null,
      configured: false,
      enabled: false,
    });
  });

  it("prefers the admin's keys over the environment's, and its switch", () => {
    vi.stubEnv("SSLCOMMERZ_STORE_ID", "envstore");
    vi.stubEnv("SSLCOMMERZ_STORE_PASSWORD", "envpass");
    const r = resolve(
      ssl,
      row({
        config: { storeId: "adminstore" },
        secrets: seal({ storePassword: "adminpass" }),
        enabled: false,
        mode: "sandbox",
      }),
    );
    expect(r).toMatchObject({ source: "admin", configured: true, enabled: false, mode: "sandbox" });
    expect(r.values).toEqual({ storeId: "adminstore", storePassword: "adminpass" });
  });

  it("is never enabled while a required key is missing", () => {
    const r = resolve(ssl, row({ config: { storeId: "only-id" }, enabled: true }));
    expect(r).toMatchObject({ configured: false, enabled: false });
  });

  it("says so when saved keys can no longer be read", () => {
    const sealed = seal({ storePassword: "x" });
    vi.stubEnv("CREDENTIALS_KEY", Buffer.alloc(32, 9).toString("base64"));
    const r = resolve(ssl, row({ config: { storeId: "s" }, secrets: sealed, enabled: true }));
    expect(r).toMatchObject({ unreadable: true, configured: false, source: "admin" });
  });

  it("is always live for a provider without a sandbox", () => {
    expect(resolve(CATALOG.steadfast, row({ provider: "steadfast", mode: "sandbox" })).mode).toBe(
      "live",
    );
  });

  it("shows plain settings in full and secrets masked", () => {
    const r = resolve(
      ssl,
      row({ config: { storeId: "zalfi123" }, secrets: seal({ storePassword: "secret-9876" }) }),
    );
    expect(shownValues(r)).toEqual({
      storeId: { set: true, display: "zalfi123" },
      storePassword: { set: true, display: "•••• 9876" },
    });
  });

  it("takes the webhook token from the admin first, then the environment", () => {
    vi.stubEnv("PATHAO_WEBHOOK_SECRET", "env-hook");
    const p = CATALOG.pathao;
    expect(resolve(p, row({ provider: "pathao" })).webhookToken).toBe("env-hook");
    expect(
      resolve(p, row({ provider: "pathao", webhookToken: seal("admin-hook") })).webhookToken,
    ).toBe("admin-hook");
  });

  it("describes every field and where to find it; the older providers keep their variables", () => {
    // Set up before the admin had an Integrations page, so the environment still works for them
    const fromEnv = [
      "sslcommerz",
      "aamarpay",
      "pathao",
      "steadfast",
      "redx",
      "bulksmsbd",
      "resend",
    ];
    for (const def of Object.values(CATALOG))
      for (const f of def.fields) {
        if (fromEnv.includes(def.name)) expect(f.env).toMatch(/^[A-Z][A-Z0-9_]+$/);
        else expect(f.env).toBeUndefined();
        expect(f.help.length).toBeGreaterThan(10);
      }
  });

  it("files every provider under its section", () => {
    const of = (g: string) =>
      Object.values(CATALOG)
        .filter((d) => d.group === g)
        .map((d) => d.name);
    expect(of("sms")).toEqual(["bulksmsbd", "sslwireless", "alphasms", "mimsms"]);
    expect(of("email")).toEqual(["resend", "brevo", "postmark", "smtp"]);
    expect(of("couriers")).toContain("carrybee");
    expect(CATALOG.carrybee.fields.find((f) => f.key === "storeId")?.pick).toBe("stores");
  });
});

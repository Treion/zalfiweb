import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { appSecret } from "@/server/secret";

/**
 * Encryption for provider keys saved in the admin (Integrations). AES-256-GCM, one envelope per
 * value set: "v1:<iv>:<tag>:<ciphertext>", base64url. The key is CREDENTIALS_KEY (32 bytes,
 * base64) when set; otherwise it is derived from BETTER_AUTH_SECRET, so no extra setup is needed.
 * Changing whichever key is in use makes saved keys unreadable: the admin then asks for them again.
 */
const VERSION = "v1";

function key(): Buffer {
  const k = env("CREDENTIALS_KEY");
  if (k) {
    const b = Buffer.from(k, "base64");
    if (b.length !== 32) throw new Error("CREDENTIALS_KEY must be 32 bytes, base64-encoded");
    return b;
  }
  return Buffer.from(hkdfSync("sha256", appSecret(), "zalfi", "integrations-v1", 32));
}

export class VaultError extends Error {}

export function seal(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const parts = [iv, cipher.getAuthTag(), ct].map((b) => b.toString("base64url"));
  return [VERSION, ...parts].join(":");
}

export function open<T = unknown>(envelope: string): T {
  const [v, iv, tag, ct] = envelope.split(":");
  if (v !== VERSION || !iv || !tag || !ct) throw new VaultError("Unknown key format");
  try {
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    const pt = Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]);
    return JSON.parse(pt.toString("utf8")) as T;
  } catch {
    throw new VaultError("Saved keys can't be read: the server's secret has changed");
  }
}

/** What the admin may see of a saved secret: its last four characters */
export function mask(value: string | null | undefined) {
  if (!value) return null;
  return value.length <= 6 ? "••••" : `•••• ${value.slice(-4)}`;
}

/** A fresh token for a provider to send with its webhooks */
export const newToken = () => randomBytes(24).toString("base64url");

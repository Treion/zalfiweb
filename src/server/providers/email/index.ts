import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { poolDb, type Executor } from "@/server/db/pool";
import { getIntegration, noteFailure, noteWorking } from "@/server/integrations";

/**
 * Sending email, behind one interface. ZALFI sends only the e-receipt to customers (and invitation
 * links to its own team).
 *  - dev (default): prints to the console and saves each email as an HTML file in .data/outbox,
 *    previewable in the admin (Dev outbox) while developing
 *  - resend: the Resend HTTP API, set up and switched on in Admin → Integrations
 */
export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** For logs and the dev outbox, e.g. "receipt" or "invitation" */
  tag: string;
  attachments?: { filename: string; content: Buffer }[];
};

export type EmailResult = { ok: true; id: string } | { ok: false; error: string };

export interface EmailProvider {
  readonly name: "dev" | "resend";
  send(msg: EmailMessage): Promise<EmailResult>;
}

export const OUTBOX_DIR = path.join(process.cwd(), ".data", "outbox");

export const devEmail: EmailProvider = {
  name: "dev",
  async send(msg) {
    const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${msg.tag}`;
    try {
      await mkdir(OUTBOX_DIR, { recursive: true });
      await writeFile(path.join(OUTBOX_DIR, `${id}.html`), msg.html);
      await writeFile(
        path.join(OUTBOX_DIR, `${id}.json`),
        JSON.stringify({ to: msg.to, subject: msg.subject, tag: msg.tag, text: msg.text }, null, 2),
      );
      for (const a of msg.attachments ?? [])
        await writeFile(path.join(OUTBOX_DIR, `${id}-${a.filename}`), a.content);
    } catch {
      /* read-only filesystem (a preview deployment): the console copy is enough */
    }
    console.info(`[email:dev] to=${msg.to} subject="${msg.subject}"\n${msg.text}`);
    return { ok: true, id };
  },
};

export function resendEmail(apiKey: string, from: string): EmailProvider {
  return {
    name: "resend",
    async send(msg) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [msg.to],
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
          attachments: msg.attachments?.map((a) => ({
            filename: a.filename,
            content: a.content.toString("base64"),
          })),
        }),
      }).catch((e: Error) => e);
      if (res instanceof Error) return { ok: false, error: res.message };
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      return res.ok && body.id
        ? { ok: true, id: body.id }
        : { ok: false, error: body.message ?? `Resend responded ${res.status}` };
    },
  };
}

/** The provider to use now: Resend when it is set up and switched on, else the stand-in */
export async function emailProvider(exec: Executor = poolDb()): Promise<EmailProvider> {
  const r = await getIntegration("resend", exec);
  if (!r.enabled) return devEmail;
  const real = resendEmail(r.values.apiKey!, r.values.from!);
  return {
    name: real.name,
    async send(msg) {
      const res = await real.send(msg);
      if (res.ok) void noteWorking(r);
      else void noteFailure("resend", `An email didn't send: ${res.error}`);
      return res;
    },
  };
}

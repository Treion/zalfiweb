import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { poolDb, type Executor } from "@/server/db/pool";
import {
  CATALOG,
  EMAIL_PROVIDERS,
  getIntegration,
  inOrder,
  noteFailure,
  noteWorking,
  type EmailName,
  type Resolved,
} from "@/server/integrations";
import { getSettings } from "@/server/settings";
import {
  brevoEmail,
  parseFrom,
  postmarkEmail,
  resendEmail,
  type EmailMessage,
  type EmailResult,
  type EmailService,
} from "./services";
import { smtpEmail } from "./smtp";

export {
  brevoEmail,
  parseFrom,
  postmarkEmail,
  resendEmail,
  smtpEmail,
  type EmailMessage,
  type EmailResult,
  type EmailService,
};

/**
 * Sending email, behind one interface. ZALFI sends only the e-receipt to customers (and invitation
 * links to its own team).
 *  - dev (default): prints to the console and saves each email as an HTML file in .data/outbox,
 *    previewable in the admin (Dev outbox) while developing
 *  - Resend, Brevo, Postmark (services.ts) and your own mailbox over SMTP (smtp.ts): set up and
 *    switched on in Admin → Integrations. With several on, they are tried in the owner's order
 *    (integrations.emailOrder): when one refuses or doesn't answer, the next sends it.
 */
export interface EmailProvider {
  readonly name: "dev" | EmailName;
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

/** A service from its saved set-up */
export function emailServiceOf(r: Resolved): EmailService {
  const v = r.values;
  switch (r.name) {
    case "brevo":
      return brevoEmail(v.apiKey!, v.from!);
    case "postmark":
      return postmarkEmail(v.serverToken!, v.from!);
    case "smtp":
      return smtpEmail({
        host: v.host!,
        port: v.port!,
        username: v.username!,
        password: v.password!,
        from: v.from!,
      });
    default:
      return resendEmail(v.apiKey!, v.from!);
  }
}

/**
 * Tries each service in turn until one sends. A refusal is flagged for the owner (Overview →
 * Needs attention) even when the next service sent the email.
 */
export function emailChain(list: { r: Resolved; service: EmailService }[]): EmailProvider {
  return {
    name: list[0]!.service.name,
    async send(msg) {
      const errors: string[] = [];
      for (const { r, service } of list) {
        const res = await service.send(msg);
        if (res.ok) {
          void noteWorking(r);
          return res;
        }
        errors.push(`${CATALOG[r.name].label}: ${res.error}`);
        void noteFailure(r.name, `An email didn't send: ${res.error}`);
      }
      return { ok: false, error: errors.join("; ") };
    },
  };
}

/** The services switched on, in the owner's order; the stand-in when none is */
export async function emailProvider(exec: Executor = poolDb()): Promise<EmailProvider> {
  const { emailOrder } = await getSettings("integrations", exec);
  const list: { r: Resolved; service: EmailService }[] = [];
  for (const name of inOrder(emailOrder, EMAIL_PROVIDERS)) {
    const r = await getIntegration(name, exec);
    if (r.enabled) list.push({ r, service: emailServiceOf(r) });
  }
  return list.length ? emailChain(list) : devEmail;
}

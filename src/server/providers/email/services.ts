import type { EmailName } from "@/server/integrations/catalog";

/**
 * The email services, one object each with a `send`: Resend, Brevo and Postmark over their HTTP
 * APIs (your own mailbox, over SMTP, is in smtp.ts). Each answers in its own words when it
 * refuses (bad key, sender not verified…). Set up and switched on in Admin → Integrations.
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

export interface EmailService {
  readonly name: EmailName;
  send(msg: EmailMessage): Promise<EmailResult>;
}

/** "ZALFI <receipts@zalfi.com>" → its name and address; a bare address has no name */
export function parseFrom(from: string): { name?: string; email: string } {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from);
  if (!m) return { email: from.trim() };
  const name = m[1]!.trim();
  return name ? { name, email: m[2]!.trim() } : { email: m[2]!.trim() };
}

const contentType = (filename: string) =>
  filename.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream";

type Json = Record<string, unknown>;
const TIMEOUT = 20_000;

async function postJson(url: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT),
    cache: "no-store",
  }).catch((e: Error) => e);
  if (res instanceof Error) return res;
  return { status: res.status, ok: res.ok, body: (await res.json().catch(() => ({}))) as Json };
}

export function resendEmail(apiKey: string, from: string): EmailService {
  return {
    name: "resend",
    async send(msg) {
      const res = await postJson(
        "https://api.resend.com/emails",
        { Authorization: `Bearer ${apiKey}` },
        {
          from,
          to: [msg.to],
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
          attachments: msg.attachments?.map((a) => ({
            filename: a.filename,
            content: a.content.toString("base64"),
          })),
        },
      );
      if (res instanceof Error) return { ok: false, error: res.message };
      return res.ok && res.body.id
        ? { ok: true, id: String(res.body.id) }
        : { ok: false, error: String(res.body.message ?? `Resend responded ${res.status}`) };
    },
  };
}

/** Brevo's transactional email API: POST v3/smtp/email, key in the api-key header */
export function brevoEmail(apiKey: string, from: string): EmailService {
  return {
    name: "brevo",
    async send(msg) {
      const res = await postJson(
        "https://api.brevo.com/v3/smtp/email",
        { "api-key": apiKey },
        {
          sender: parseFrom(from),
          to: [{ email: msg.to }],
          subject: msg.subject,
          htmlContent: msg.html,
          textContent: msg.text,
          ...(msg.attachments?.length
            ? {
                attachment: msg.attachments.map((a) => ({
                  name: a.filename,
                  content: a.content.toString("base64"),
                })),
              }
            : {}),
        },
      );
      if (res instanceof Error) return { ok: false, error: res.message };
      return res.ok && res.body.messageId
        ? { ok: true, id: String(res.body.messageId) }
        : { ok: false, error: String(res.body.message ?? `Brevo responded ${res.status}`) };
    },
  };
}

/** Postmark: POST /email with the server token; ErrorCode 0 means it was accepted */
export function postmarkEmail(serverToken: string, from: string): EmailService {
  return {
    name: "postmark",
    async send(msg) {
      const res = await postJson(
        "https://api.postmarkapp.com/email",
        { "X-Postmark-Server-Token": serverToken },
        {
          From: from,
          To: msg.to,
          Subject: msg.subject,
          HtmlBody: msg.html,
          TextBody: msg.text,
          MessageStream: "outbound",
          ...(msg.attachments?.length
            ? {
                Attachments: msg.attachments.map((a) => ({
                  Name: a.filename,
                  Content: a.content.toString("base64"),
                  ContentType: contentType(a.filename),
                })),
              }
            : {}),
        },
      );
      if (res instanceof Error) return { ok: false, error: res.message };
      return res.ok && Number(res.body.ErrorCode) === 0 && res.body.MessageID
        ? { ok: true, id: String(res.body.MessageID) }
        : { ok: false, error: String(res.body.Message ?? `Postmark responded ${res.status}`) };
    },
  };
}

import type { EmailService } from "./services";

/**
 * Your own mailbox over SMTP: Google Workspace or Gmail (an app password), Zoho Mail, or a web
 * host's email. nodemailer is loaded only when this is used. Port 465 speaks TLS from the start;
 * any other port must upgrade with STARTTLS, so the password never travels in the clear (a mail
 * server on this computer, for testing, is the one exception).
 */
export type SmtpConfig = {
  host: string;
  port: string;
  username: string;
  password: string;
  from: string;
};

const LOCAL = new Set(["localhost", "127.0.0.1", "::1"]);

export function smtpOptions(cfg: SmtpConfig) {
  const port = Number(cfg.port);
  if (!Number.isInteger(port) || port < 1 || port > 65_535)
    throw new Error(`The SMTP port "${cfg.port}" isn't a port number (try 465 or 587).`);
  const host = cfg.host.trim();
  return {
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465 && !LOCAL.has(host),
    auth: { user: cfg.username, pass: cfg.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  };
}

async function transport(cfg: SmtpConfig) {
  const nodemailer = await import("nodemailer");
  return nodemailer.createTransport(smtpOptions(cfg));
}

const reason = (e: unknown) => {
  const err = e as { message?: string; responseCode?: number; code?: string };
  if (err.responseCode === 535 || err.code === "EAUTH")
    return "The mail server refused the username or password. For Gmail, use an app password.";
  return err.message ?? String(e);
};

export function smtpEmail(cfg: SmtpConfig): EmailService & { verify(): Promise<string | null> } {
  return {
    name: "smtp",
    async send(msg) {
      try {
        const t = await transport(cfg);
        const info = await t.sendMail({
          from: cfg.from,
          to: msg.to,
          subject: msg.subject,
          text: msg.text,
          html: msg.html,
          attachments: msg.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
        });
        t.close();
        return { ok: true, id: String(info.messageId ?? "") };
      } catch (e) {
        return { ok: false, error: reason(e) };
      }
    },
    /** Signs in without sending: null when it worked, else what went wrong */
    async verify() {
      try {
        const t = await transport(cfg);
        await t.verify();
        t.close();
        return null;
      } catch (e) {
        return reason(e);
      }
    },
  };
}

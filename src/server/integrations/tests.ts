import { randomBytes } from "node:crypto";
import { normalisePhone } from "@/lib/phone";
import { siteUrl } from "@/lib/env";
import { aamarpay } from "@/server/payments/aamarpay";
import { aamarConfigOf, sslConfigOf } from "@/server/payments/providers";
import { sslcommerz } from "@/server/payments/sslcommerz";
import type { PaymentProvider } from "@/server/payments/types";
import { smsGatewayOf } from "@/server/providers/sms";
import { emailServiceOf, smtpEmail } from "@/server/providers/email";
import { carrybee } from "@/server/shipping/carrybee";
import {
  carrybeeConfigOf,
  pathaoConfigOf,
  redxConfigOf,
  steadfastConfigOf,
} from "@/server/shipping/couriers";
import { pathao } from "@/server/shipping/pathao";
import { redx } from "@/server/shipping/redx";
import { steadfast } from "@/server/shipping/steadfast";
import type { Resolved } from "./index";

/**
 * "Test connection", one per provider. Each proves the saved keys work with a call that changes
 * nothing that matters: a payment page opened and left (no money moves), a store list, a balance,
 * one SMS or email to the owner. The answer is in the provider's own words when it refuses.
 */
export type TestResult = {
  ok: boolean;
  message: string;
  /** Pickup stores to choose from (Pathao, RedX) */
  stores?: { id: string; name: string; address: string }[];
};

const stores = (n: number) => `${n} pickup store${n === 1 ? "" : "s"}`;

/** The fields a test needs: the required ones, except those it helps choose (a store) */
function missing(r: Resolved) {
  return r.def.fields.filter((f) => f.required && !f.pick && !r.values[f.key]).map((f) => f.label);
}

async function openTestPage(p: PaymentProvider): Promise<TestResult> {
  const base = siteUrl().replace(/\/$/, "");
  const tranId = `TEST-${randomBytes(4).toString("hex").toUpperCase()}`;
  await p.createSession({
    tranId,
    amount: 1_000,
    orderNumber: "TEST",
    customer: {
      name: "ZALFI test",
      email: "test@zalfi.test",
      phone: "01700000000",
      address: "Connection test",
      district: "Dhaka",
    },
    items: [{ name: "Connection test", qty: 1 }],
    urls: {
      success: `${base}/admin/integrations`,
      fail: `${base}/admin/integrations`,
      cancel: `${base}/admin/integrations`,
      ipn: `${base}/api/payments/ipn/${p.name}`,
    },
  });
  return {
    ok: true,
    message: `Connected (${p.mode}). A payment page opened and was left: no money moved.`,
  };
}

export async function testIntegration(
  r: Resolved,
  opts: { to?: string; ownerEmail: string },
): Promise<TestResult> {
  if (r.unreadable)
    return { ok: false, message: "The saved keys can't be read any more. Enter them again." };
  const gaps = missing(r);
  if (gaps.length) return { ok: false, message: `Fill in ${gaps.join(", ")} first.` };
  try {
    switch (r.name) {
      case "sslcommerz":
        return await openTestPage(sslcommerz(sslConfigOf(r)));
      case "aamarpay":
        return await openTestPage(aamarpay(aamarConfigOf(r)));
      case "pathao": {
        const list = await pathao(pathaoConfigOf(r)).stores();
        return {
          ok: true,
          message: `Signed in to Pathao (${r.mode}) as ${r.values.username}. ${stores(list.length)}.`,
          stores: list.map((s) => ({ id: String(s.id), name: s.name, address: s.address })),
        };
      }
      case "steadfast": {
        const balance = await steadfast(steadfastConfigOf(r)).balance();
        return {
          ok: true,
          message: `Connected to Steadfast. Balance: ৳${balance.toLocaleString("en-IN")}.`,
        };
      }
      case "redx": {
        const list = await redx(redxConfigOf(r)).stores();
        return {
          ok: true,
          message: `Connected to RedX (${r.mode}). ${stores(list.length)}.`,
          stores: list.map((s) => ({ id: String(s.id), name: s.name, address: s.address })),
        };
      }
      case "carrybee": {
        const list = await carrybee(carrybeeConfigOf(r)).stores();
        return {
          ok: true,
          message: `Connected to CarryBee (${r.mode}). ${stores(list.length)}.`,
          stores: list,
        };
      }
      case "bulksmsbd":
      case "sslwireless":
      case "alphasms":
      case "mimsms": {
        const to = opts.to ? normalisePhone(opts.to) : null;
        if (!to)
          return { ok: false, message: "Enter a Bangladeshi mobile number to send the test to." };
        const gateway = smsGatewayOf(r);
        const sent = await gateway.send(to, "ZALFI: this is a test message. SMS is working.");
        if (!sent.ok) return { ok: false, message: sent.error };
        const balance = await gateway.balance?.().catch(() => null);
        return {
          ok: true,
          message: `Sent a test SMS to ${to}. Check the phone.${balance ? ` Balance: ${balance}.` : ""}`,
        };
      }
      case "resend":
      case "brevo":
      case "postmark":
      case "smtp": {
        if (r.name === "smtp") {
          const refused = await smtpEmail({
            host: r.values.host!,
            port: r.values.port!,
            username: r.values.username!,
            password: r.values.password!,
            from: r.values.from!,
          }).verify();
          if (refused) return { ok: false, message: refused };
        }
        const sent = await emailServiceOf(r).send({
          to: opts.ownerEmail,
          subject: "ZALFI: test email",
          text: "This is a test from Admin → Integrations. Email is working.",
          html: "<p>This is a test from Admin → Integrations. Email is working.</p>",
          tag: "integration-test",
        });
        return sent.ok
          ? { ok: true, message: `Sent a test email to ${opts.ownerEmail}.` }
          : { ok: false, message: sent.error };
      }
      case "test-gateway":
      case "test-courier":
        return { ok: true, message: "Ready. It runs inside this site: nothing to connect to." };
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: /aborted|timeout/i.test(message)
        ? `${r.def.label} didn't answer in time. Try again in a minute.`
        : message.slice(0, 300),
    };
  }
}

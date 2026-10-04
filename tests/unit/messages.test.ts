import { afterEach, describe, expect, it, vi } from "vitest";

const noted = vi.hoisted(() => ({ failures: [] as [string, string][], working: [] as string[] }));
vi.mock("@/server/integrations", async (load) => ({
  ...(await load<typeof import("@/server/integrations")>()),
  noteFailure: async (name: string, message: string) => void noted.failures.push([name, message]),
  noteWorking: async (r: { name: string }) => void noted.working.push(r.name),
}));

import { CATALOG, EMAIL_PROVIDERS, inOrder, SMS_PROVIDERS } from "@/server/integrations";
import type { Resolved } from "@/server/integrations";
import { alphaSms, csmsId, mimSms, sslWireless } from "@/server/providers/sms/gateways";
import { smsChain } from "@/server/providers/sms";
import { brevoEmail, parseFrom, postmarkEmail } from "@/server/providers/email/services";
import { smtpOptions } from "@/server/providers/email/smtp";
import { emailChain } from "@/server/providers/email";

type Call = { url: string; init: RequestInit };
function stub(...answers: (unknown | Error)[]) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      const a = answers[Math.min(calls.length - 1, answers.length - 1)];
      if (a instanceof Error) throw a;
      return Response.json(a);
    }),
  );
  return calls;
}
const jsonOf = (c: Call) => JSON.parse(String(c.init.body)) as Record<string, unknown>;
const formOf = (c: Call) => Object.fromEntries(c.init.body as URLSearchParams);
const headerOf = (c: Call, name: string) => new Headers(c.init.headers).get(name);

afterEach(() => {
  vi.unstubAllGlobals();
  noted.failures.length = 0;
  noted.working.length = 0;
});

describe("SMS gateways", () => {
  it("SSL Wireless: sends with the token, SID and a unique reference", async () => {
    const calls = stub({
      status: "SUCCESS",
      status_code: 200,
      error_message: "",
      smsinfo: [{ sms_status: "SUCCESS", status_message: "Success", reference_id: "ref-1" }],
    });
    expect(await sslWireless("tok", "ZALFIBRAND").send("01712345678", "Code 1234")).toEqual({
      ok: true,
      id: "ref-1",
    });
    expect(calls[0]!.url).toBe("https://smsplus.sslwireless.com/api/v3/send-sms");
    expect(jsonOf(calls[0]!)).toMatchObject({
      api_token: "tok",
      sid: "ZALFIBRAND",
      msisdn: "8801712345678",
      sms: "Code 1234",
    });
    expect(String(jsonOf(calls[0]!).csms_id).length).toBeLessThanOrEqual(20);
    expect(csmsId()).not.toBe(csmsId());

    stub({ status: "FAILED", status_code: 4001, error_message: "Unauthorized request" });
    expect(await sslWireless("bad", "S").send("01712345678", "x")).toEqual({
      ok: false,
      error: "Unauthorized request",
    });
  });

  it("Alpha SMS: posts the form, reads error 0, and reports the balance", async () => {
    const calls = stub(
      { error: 0, msg: "Request successfully submitted", data: { request_id: 5021 } },
      { error: 0, msg: "Success", data: { balance: "152.5000" } },
    );
    const g = alphaSms("key", "ZALFI");
    expect(await g.send("01712345678", "Code 1234")).toEqual({ ok: true, id: "5021" });
    expect(calls[0]!.url).toBe("https://api.sms.net.bd/sendsms");
    expect(formOf(calls[0]!)).toEqual({
      api_key: "key",
      msg: "Code 1234",
      to: "8801712345678",
      sender_id: "ZALFI",
    });
    expect(await g.balance!()).toBe("152.5000");
    expect(calls[1]!.url).toBe("https://api.sms.net.bd/user/balance/?api_key=key");

    const noSender = stub({ error: 417, msg: "Insufficient balance" });
    expect(await alphaSms("key").send("01712345678", "x")).toEqual({
      ok: false,
      error: "Insufficient balance",
    });
    expect(formOf(noSender[0]!).sender_id).toBeUndefined();
  });

  it("MiMSMS: sends a transactional SMS and reads statusCode 200", async () => {
    const calls = stub(
      { statusCode: "200", status: "Success", trxnId: "T-77", responseResult: "SMS sent" },
      { statusCode: "200", status: "Ok", trxnId: "", responseResult: "999.54" },
    );
    const g = mimSms("owner@zalfi.com", "key", "8809601000000");
    expect(await g.send("01712345678", "Code 1234")).toEqual({ ok: true, id: "T-77" });
    expect(calls[0]!.url).toBe("https://api.mimsms.com/api/SmsSending/SMS");
    expect(jsonOf(calls[0]!)).toEqual({
      UserName: "owner@zalfi.com",
      Apikey: "key",
      MobileNumber: "8801712345678",
      CampaignId: "null",
      SenderName: "8809601000000",
      TransactionType: "T",
      Message: "Code 1234",
    });
    expect(await g.balance!()).toBe("999.54");

    stub({ statusCode: "216", status: "FAILED", responseResult: "Insufficient Balance" });
    const r = await g.send("01712345678", "x");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("Insufficient Balance");
  });

  it("a gateway that doesn't answer is a failure, not a crash", async () => {
    stub(new TypeError("fetch failed"));
    expect(await sslWireless("t", "s").send("01712345678", "x")).toEqual({
      ok: false,
      error: "fetch failed",
    });
  });
});

const resolved = (name: Resolved["name"]) => ({ name, def: CATALOG[name] }) as Resolved;

describe("the send order", () => {
  it("completes a saved order: no repeats, new providers at the end", () => {
    expect(inOrder(["mimsms", "mimsms", "bulksmsbd"], SMS_PROVIDERS)).toEqual([
      "mimsms",
      "bulksmsbd",
      "sslwireless",
      "alphasms",
    ]);
    expect(inOrder([], EMAIL_PROVIDERS)).toEqual([...EMAIL_PROVIDERS]);
  });

  it("SMS: the next gateway sends when the first refuses, and the refusal is flagged", async () => {
    const first = {
      name: "sslwireless" as const,
      send: vi.fn(async () => ({ ok: false as const, error: "No balance" })),
    };
    const second = {
      name: "alphasms" as const,
      send: vi.fn(async () => ({ ok: true as const, id: "9" })),
    };
    const chain = smsChain([
      { r: resolved("sslwireless"), gateway: first },
      { r: resolved("alphasms"), gateway: second },
    ]);
    expect(await chain.send("01712345678", "Code")).toEqual({ ok: true, id: "9" });
    expect(second.send).toHaveBeenCalledOnce();
    expect(noted.failures).toEqual([["sslwireless", "An SMS didn't send: No balance"]]);
    expect(noted.working).toEqual(["alphasms"]);
  });

  it("SMS: when every gateway refuses, says what each one said", async () => {
    const no = (error: string) => ({ ok: false as const, error });
    const chain = smsChain([
      { r: resolved("bulksmsbd"), gateway: { name: "bulksmsbd", send: async () => no("Bad key") } },
      { r: resolved("mimsms"), gateway: { name: "mimsms", send: async () => no("Not active") } },
    ]);
    expect(await chain.send("01712345678", "Code")).toEqual({
      ok: false,
      error: "BulkSMSBD: Bad key; MiMSMS: Not active",
    });
  });

  it("email: the next service sends when the first refuses", async () => {
    const msg = { to: "a@b.co", subject: "s", html: "<p>h</p>", text: "h", tag: "receipt" };
    const chain = emailChain([
      {
        r: resolved("postmark"),
        service: {
          name: "postmark",
          send: async () => ({ ok: false, error: "Sender not verified" }),
        },
      },
      {
        r: resolved("smtp"),
        service: { name: "smtp", send: async () => ({ ok: true, id: "m1" }) },
      },
    ]);
    expect(await chain.send(msg)).toEqual({ ok: true, id: "m1" });
    expect(noted.failures).toEqual([["postmark", "An email didn't send: Sender not verified"]]);
  });
});

describe("email services", () => {
  const msg = {
    to: "nusrat@example.com",
    subject: "Your ZALFI receipt",
    html: "<p>Thank you</p>",
    text: "Thank you",
    tag: "receipt-ZLF-001234",
    attachments: [{ filename: "ZALFI-ZLF-001234.pdf", content: Buffer.from("%PDF-1.7") }],
  };

  it("reads a sender with or without a name", () => {
    expect(parseFrom("ZALFI <receipts@zalfi.com>")).toEqual({
      name: "ZALFI",
      email: "receipts@zalfi.com",
    });
    expect(parseFrom('"ZALFI House" <hi@zalfi.com>')).toEqual({
      name: "ZALFI House",
      email: "hi@zalfi.com",
    });
    expect(parseFrom("receipts@zalfi.com")).toEqual({ email: "receipts@zalfi.com" });
  });

  it("Brevo: sends with the api-key header, sender and attachment", async () => {
    const calls = stub({ messageId: "<2026@smtp-relay.brevo.com>" });
    expect(await brevoEmail("xkeysib-1", "ZALFI <receipts@zalfi.com>").send(msg)).toEqual({
      ok: true,
      id: "<2026@smtp-relay.brevo.com>",
    });
    expect(calls[0]!.url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(headerOf(calls[0]!, "api-key")).toBe("xkeysib-1");
    expect(jsonOf(calls[0]!)).toEqual({
      sender: { name: "ZALFI", email: "receipts@zalfi.com" },
      to: [{ email: "nusrat@example.com" }],
      subject: "Your ZALFI receipt",
      htmlContent: "<p>Thank you</p>",
      textContent: "Thank you",
      attachment: [
        { name: "ZALFI-ZLF-001234.pdf", content: Buffer.from("%PDF-1.7").toString("base64") },
      ],
    });
    stub({ code: "unauthorized", message: "Key not found" });
    expect(await brevoEmail("bad", "a@b.co").send(msg)).toEqual({
      ok: false,
      error: "Key not found",
    });
  });

  it("Postmark: sends with the server token and a PDF attachment", async () => {
    const calls = stub({ ErrorCode: 0, Message: "OK", MessageID: "b7bc2f4a" });
    expect(await postmarkEmail("pm-token", "ZALFI <receipts@zalfi.com>").send(msg)).toEqual({
      ok: true,
      id: "b7bc2f4a",
    });
    expect(calls[0]!.url).toBe("https://api.postmarkapp.com/email");
    expect(headerOf(calls[0]!, "x-postmark-server-token")).toBe("pm-token");
    expect(jsonOf(calls[0]!)).toMatchObject({
      From: "ZALFI <receipts@zalfi.com>",
      To: "nusrat@example.com",
      MessageStream: "outbound",
      Attachments: [{ Name: "ZALFI-ZLF-001234.pdf", ContentType: "application/pdf" }],
    });
    stub({ ErrorCode: 400, Message: "The 'From' address you supplied is not a Sender Signature" });
    const r = await postmarkEmail("pm-token", "x@y.z").send(msg);
    expect(!r.ok && r.error).toContain("Sender Signature");
  });

  it("SMTP: TLS on 465, STARTTLS required elsewhere, except on this computer", () => {
    const base = { username: "u", password: "p", from: "a@b.co" };
    expect(smtpOptions({ ...base, host: "smtp.gmail.com", port: "465" })).toMatchObject({
      port: 465,
      secure: true,
      requireTLS: false,
    });
    expect(smtpOptions({ ...base, host: "smtp.zoho.com", port: "587" })).toMatchObject({
      secure: false,
      requireTLS: true,
    });
    expect(smtpOptions({ ...base, host: "127.0.0.1", port: "2525" }).requireTLS).toBe(false);
    expect(() => smtpOptions({ ...base, host: "h", port: "smtp" })).toThrow(/port/);
  });
});

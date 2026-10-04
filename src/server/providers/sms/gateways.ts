import { randomBytes } from "node:crypto";
import { internationalPhone } from "@/lib/phone";
import { maskPhone } from "@/server/request";
import type { SmsName } from "@/server/integrations/catalog";

/**
 * The Bangladeshi SMS gateways, one object each with a `send`. Each takes the number as
 * 8801XXXXXXXXX and answers in its own words when it refuses (bad key, no balance, sender ID not
 * approved…). Set up and switched on in Admin → Integrations.
 */
export type SmsResult = { ok: true; id?: string } | { ok: false; error: string };

export interface SmsGateway {
  readonly name: SmsName;
  send(to: string, text: string): Promise<SmsResult>;
  /** The account's balance, for Test connection, where the gateway reports it */
  balance?(): Promise<string | null>;
}

type Json = Record<string, unknown>;
const TIMEOUT = 10_000;

async function post(url: string, init: RequestInit): Promise<Json | Error> {
  const res = await fetch(url, {
    method: "POST",
    ...init,
    signal: AbortSignal.timeout(TIMEOUT),
    cache: "no-store",
  }).catch((e: Error) => e);
  if (res instanceof Error) return res;
  return (await res.json().catch(() => ({ httpStatus: res.status }))) as Json;
}

const json = (body: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify(body),
});

/** BulkSMSBD response codes: 202 is accepted; the rest are errors (bad key, balance, sender…) */
export function bulkSmsBd(apiKey: string, senderId: string): SmsGateway {
  return {
    name: "bulksmsbd",
    async send(to, text) {
      const data = await post("https://bulksmsbd.net/api/smsapi", {
        body: new URLSearchParams({
          api_key: apiKey,
          type: "text",
          number: internationalPhone(to),
          senderid: senderId,
          message: text,
        }),
      });
      if (data instanceof Error) return { ok: false, error: data.message };
      if (data.response_code === 202) return { ok: true, id: String(data.message_id ?? "") };
      console.warn(`[sms:bulksmsbd] to=${maskPhone(to)} code=${String(data.response_code)}`);
      return {
        ok: false,
        error: data.error_message
          ? String(data.error_message)
          : `BulkSMSBD responded ${String(data.response_code ?? data.httpStatus)}`,
      };
    },
  };
}

/** SSL Wireless's own message reference: unique, at most 20 characters */
export const csmsId = () =>
  `Z${Date.now().toString(36)}${randomBytes(4).toString("hex")}`.slice(0, 20).toUpperCase();

/**
 * SSL Wireless ISMS Plus, API v3: POST send-sms with api_token, sid, msisdn, sms and csms_id. It
 * answers status SUCCESS (and one smsinfo row per number), or FAILED with an error_message.
 */
export function sslWireless(apiToken: string, sid: string): SmsGateway {
  return {
    name: "sslwireless",
    async send(to, text) {
      const data = await post(
        "https://smsplus.sslwireless.com/api/v3/send-sms",
        json({
          api_token: apiToken,
          sid,
          msisdn: internationalPhone(to),
          sms: text,
          csms_id: csmsId(),
        }),
      );
      if (data instanceof Error) return { ok: false, error: data.message };
      const info = (Array.isArray(data.smsinfo) ? data.smsinfo[0] : null) as Json | null;
      const success = (v: unknown) => String(v ?? "").toUpperCase() === "SUCCESS";
      if (success(data.status) && (!info || success(info.sms_status)))
        return { ok: true, id: info?.reference_id ? String(info.reference_id) : undefined };
      console.warn(`[sms:sslwireless] to=${maskPhone(to)} code=${String(data.status_code)}`);
      const reason = data.error_message || info?.status_message;
      return {
        ok: false,
        error: reason
          ? String(reason)
          : `SSL Wireless responded ${String(data.status_code ?? data.httpStatus)}`,
      };
    },
  };
}

/**
 * Alpha SMS (sms.net.bd): POST sendsms with api_key, msg, to (and sender_id, if approved). It
 * answers error 0 with a request_id, or an error code with a message. Balance: GET user/balance.
 */
export function alphaSms(apiKey: string, senderId?: string): SmsGateway {
  return {
    name: "alphasms",
    async send(to, text) {
      const body = new URLSearchParams({ api_key: apiKey, msg: text, to: internationalPhone(to) });
      if (senderId) body.set("sender_id", senderId);
      const data = await post("https://api.sms.net.bd/sendsms", { body });
      if (data instanceof Error) return { ok: false, error: data.message };
      if (data.error === 0 || data.error === "0") {
        const d = (data.data ?? {}) as Json;
        return { ok: true, id: d.request_id != null ? String(d.request_id) : undefined };
      }
      console.warn(`[sms:alphasms] to=${maskPhone(to)} code=${String(data.error)}`);
      return {
        ok: false,
        error: data.msg
          ? String(data.msg)
          : `Alpha SMS responded ${String(data.error ?? data.httpStatus)}`,
      };
    },
    async balance() {
      const res = await fetch(
        `https://api.sms.net.bd/user/balance/?api_key=${encodeURIComponent(apiKey)}`,
        { signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" },
      ).catch(() => null);
      const data = ((await res?.json().catch(() => null)) ?? null) as Json | null;
      const b = (data?.data as Json | undefined)?.balance;
      return data && Number(data.error) === 0 && b != null ? String(b) : null;
    },
  };
}

/**
 * MiMSMS, API v2: POST SmsSending/SMS with UserName (the panel login email), Apikey, MobileNumber,
 * SenderName, TransactionType "T" (transactional) and Message. It answers statusCode "200" with a
 * trxnId, or an error code (208, 213, 216…) with responseResult. Balance: SmsSending/balanceCheck.
 */
export function mimSms(username: string, apiKey: string, senderName: string): SmsGateway {
  return {
    name: "mimsms",
    async send(to, text) {
      const data = await post(
        "https://api.mimsms.com/api/SmsSending/SMS",
        json({
          UserName: username,
          Apikey: apiKey,
          MobileNumber: internationalPhone(to),
          CampaignId: "null",
          SenderName: senderName,
          TransactionType: "T",
          Message: text,
        }),
      );
      if (data instanceof Error) return { ok: false, error: data.message };
      if (String(data.statusCode) === "200")
        return { ok: true, id: data.trxnId ? String(data.trxnId) : undefined };
      console.warn(`[sms:mimsms] to=${maskPhone(to)} code=${String(data.statusCode)}`);
      const reason = data.responseResult || data.status;
      return {
        ok: false,
        error: reason
          ? `MiMSMS: ${String(reason)} (${String(data.statusCode ?? data.httpStatus)})`
          : `MiMSMS responded ${String(data.statusCode ?? data.httpStatus)}`,
      };
    },
    async balance() {
      const data = await post(
        "https://api.mimsms.com/api/SmsSending/balanceCheck",
        json({ UserName: username, Apikey: apiKey }),
      );
      if (data instanceof Error || String(data.statusCode) !== "200") return null;
      return data.responseResult != null ? String(data.responseResult) : null;
    },
  };
}

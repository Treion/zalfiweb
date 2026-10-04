import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { internationalPhone } from "@/lib/phone";
import { poolDb, type Executor } from "@/server/db/pool";
import { getIntegration, noteFailure, noteWorking } from "@/server/integrations";
import { maskPhone } from "@/server/request";

/**
 * Sending SMS, behind one interface. ZALFI sends one kind: the checkout's verification code.
 *  - dev (default): prints the message (code included) to the console and .data/sms.log
 *  - bulksmsbd: BulkSMSBD's HTTP API, set up and switched on in Admin → Integrations
 * Another gateway (SSL Wireless, Alpha SMS) is one more object with a `send`, plus an entry in the
 * integrations catalogue.
 */
export type SmsResult = { ok: true; id?: string } | { ok: false; error: string };

export interface SmsProvider {
  readonly name: "dev" | "bulksmsbd";
  send(to: string, text: string): Promise<SmsResult>;
}

export const devSms: SmsProvider = {
  name: "dev",
  async send(to, text) {
    console.info(`[sms:dev] to=${to} ${text}`);
    try {
      const dir = path.join(process.cwd(), ".data");
      await mkdir(dir, { recursive: true });
      await appendFile(
        path.join(dir, "sms.log"),
        `${new Date().toISOString()} ${to} ${JSON.stringify(text)}\n`,
      );
    } catch {
      /* read-only filesystem: the console copy is enough */
    }
    return { ok: true };
  },
};

/** BulkSMSBD response codes: 202 is accepted; the rest are errors (bad key, balance, sender…) */
export function bulkSmsBd(apiKey: string, senderId: string): SmsProvider {
  return {
    name: "bulksmsbd",
    async send(to, text) {
      const body = new URLSearchParams({
        api_key: apiKey,
        type: "text",
        number: internationalPhone(to),
        senderid: senderId,
        message: text,
      });
      const res = await fetch("https://bulksmsbd.net/api/smsapi", {
        method: "POST",
        body,
        signal: AbortSignal.timeout(10_000),
      }).catch((e: Error) => e);
      if (res instanceof Error) return { ok: false, error: res.message };
      const data = (await res.json().catch(() => ({}))) as {
        response_code?: number;
        error_message?: string;
        message_id?: string | number;
      };
      if (data.response_code === 202) return { ok: true, id: String(data.message_id ?? "") };
      console.warn(`[sms:bulksmsbd] to=${maskPhone(to)} code=${data.response_code}`);
      return {
        ok: false,
        error: data.error_message ?? `BulkSMSBD responded ${data.response_code}`,
      };
    },
  };
}

/** The provider to use now: BulkSMSBD when it is set up and switched on, else the stand-in */
export async function smsProvider(exec: Executor = poolDb()): Promise<SmsProvider> {
  const r = await getIntegration("bulksmsbd", exec);
  if (!r.enabled) return devSms;
  const real = bulkSmsBd(r.values.apiKey!, r.values.senderId!);
  return {
    name: real.name,
    async send(to, text) {
      const res = await real.send(to, text);
      if (res.ok) void noteWorking(r);
      else void noteFailure("bulksmsbd", `An SMS didn't send: ${res.error}`);
      return res;
    },
  };
}

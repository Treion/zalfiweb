import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { poolDb, type Executor } from "@/server/db/pool";
import {
  CATALOG,
  getIntegration,
  inOrder,
  noteFailure,
  noteWorking,
  SMS_PROVIDERS,
  type Resolved,
  type SmsName,
} from "@/server/integrations";
import { getSettings } from "@/server/settings";
import {
  alphaSms,
  bulkSmsBd,
  mimSms,
  sslWireless,
  type SmsGateway,
  type SmsResult,
} from "./gateways";

export { alphaSms, bulkSmsBd, mimSms, sslWireless, type SmsGateway, type SmsResult };

/**
 * Sending SMS, behind one interface. ZALFI sends one kind: the checkout's verification code.
 *  - dev (default): prints the message (code included) to the console and .data/sms.log
 *  - BulkSMSBD, SSL Wireless, Alpha SMS, MiMSMS (gateways.ts): set up and switched on in Admin →
 *    Integrations. With several on, they are tried in the owner's order (integrations.smsOrder):
 *    when one refuses or doesn't answer, the next sends the code.
 */
export interface SmsProvider {
  readonly name: "dev" | SmsName;
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

/** A gateway from its saved set-up */
export function smsGatewayOf(r: Resolved): SmsGateway {
  const v = r.values;
  switch (r.name) {
    case "sslwireless":
      return sslWireless(v.apiToken!, v.sid!);
    case "alphasms":
      return alphaSms(v.apiKey!, v.senderId || undefined);
    case "mimsms":
      return mimSms(v.username!, v.apiKey!, v.senderName!);
    default:
      return bulkSmsBd(v.apiKey!, v.senderId!);
  }
}

/**
 * Tries each gateway in turn until one sends. A refusal is flagged for the owner (Overview →
 * Needs attention) even when the next gateway sent the message, so a broken key gets fixed.
 */
export function smsChain(list: { r: Resolved; gateway: SmsGateway }[]): SmsProvider {
  return {
    name: list[0]!.gateway.name,
    async send(to, text) {
      const errors: string[] = [];
      for (const { r, gateway } of list) {
        const res = await gateway.send(to, text);
        if (res.ok) {
          void noteWorking(r);
          return res;
        }
        errors.push(`${CATALOG[r.name].label}: ${res.error}`);
        void noteFailure(r.name, `An SMS didn't send: ${res.error}`);
      }
      return { ok: false, error: errors.join("; ") };
    },
  };
}

/** The gateways switched on, in the owner's order; the stand-in when none is */
export async function smsProvider(exec: Executor = poolDb()): Promise<SmsProvider> {
  const { smsOrder } = await getSettings("integrations", exec);
  const list: { r: Resolved; gateway: SmsGateway }[] = [];
  for (const name of inOrder(smsOrder, SMS_PROVIDERS)) {
    const r = await getIntegration(name, exec);
    if (r.enabled) list.push({ r, gateway: smsGatewayOf(r) });
  }
  return list.length ? smsChain(list) : devSms;
}

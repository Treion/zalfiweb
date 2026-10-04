import type { LastCheck } from "@/server/integrations";
import type { IntegrationName, Mode } from "@/server/integrations/catalog";
import type { Settings } from "@/server/settings/schema";

/** One provider as the Integrations page shows it: never a secret, only whether it is set */
export type ProviderView = {
  name: IntegrationName;
  label: string;
  group: "payments" | "couriers" | "messages";
  blurb: string;
  modes: Mode[];
  steps: string[];
  testOnly: boolean;
  sandboxValues: Record<string, string> | null;
  fields: {
    key: string;
    label: string;
    secret: boolean;
    required: boolean;
    help: string;
    placeholder: string | null;
    pick: boolean;
    set: boolean;
    /** Plain values in full; secrets as "•••• 1234" */
    display: string | null;
  }[];
  configured: boolean;
  enabled: boolean;
  mode: Mode;
  source: "admin" | "env" | null;
  unreadable: boolean;
  lastCheck: LastCheck | null;
  webhook: {
    url: string;
    how: string;
    /** Only the owner sees the token, to paste into the provider's panel */
    token: string | null;
    tokenLabel: string | null;
    inUrl: boolean;
  } | null;
};

export type IntegrationsData = {
  providers: ProviderView[];
  canManage: boolean;
  gatewayFirst: "sslcommerz" | "aamarpay";
  payments: Settings<"payments">;
  manualCourierEnabled: boolean;
  /** Where the site is reached: the base of every callback address */
  siteUrl: string;
  /** False on the live site: no test providers there */
  testAllowed: boolean;
};

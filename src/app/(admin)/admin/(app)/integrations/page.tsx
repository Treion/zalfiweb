import { headers } from "next/headers";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { env } from "@/lib/env";
import { isMissingTable } from "@/server/db/errors";
import { requireAdmin } from "@/server/auth/session";
import { getIntegrations, shownValues, webhookToken } from "@/server/integrations";
import { getAllSettings } from "@/server/settings";
import { testProvidersAllowed } from "@/server/test-mode";
import { IntegrationsView } from "./IntegrationsView";
import type { ProviderView } from "./view-model";

export const metadata = { title: "Integrations" };

async function baseUrl() {
  const configured = env("NEXT_PUBLIC_SITE_URL");
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

export default async function IntegrationsPage() {
  const admin = await requireAdmin("settings.view");
  const canManage = admin.can("integrations.manage");
  // The owner gets a webhook token for each courier that needs one, made the first time
  try {
    if (canManage)
      for (const n of ["pathao", "steadfast", "redx"] as const) await webhookToken(n, admin.actor);
  } catch (e) {
    if (!isMissingTable(e)) throw e;
    return (
      <>
        <PageHeader title="Integrations" />
        <p className="max-w-xl rounded-md bg-[var(--tone-warning-bg)] px-4 py-3 text-sm text-[var(--tone-warning-fg)]">
          The database needs an update before this page can work. On your computer, run{" "}
          <code className="font-mono">npm run db:migrate</code> (or restart{" "}
          <code className="font-mono">npm run dev</code>, which does it for you). For the live site,
          see &ldquo;Updating the site later&rdquo; in the deploy guide.
        </p>
      </>
    );
  }
  const [list, settings, site] = await Promise.all([
    getIntegrations(),
    getAllSettings(),
    baseUrl(),
  ]);
  const testAllowed = testProvidersAllowed();

  const providers: ProviderView[] = list
    .filter((r) => !r.def.testOnly || testAllowed)
    .map((r) => {
      const shown = shownValues(r);
      const hook = r.def.webhook;
      return {
        name: r.name,
        label: r.def.label,
        group: r.def.group,
        blurb: r.def.blurb,
        modes: r.def.modes,
        steps: r.def.steps,
        testOnly: !!r.def.testOnly,
        sandboxValues: r.def.sandboxValues ?? null,
        fields: r.def.fields.map((f) => ({
          key: f.key,
          label: f.label,
          secret: !!f.secret,
          required: !!f.required,
          help: f.help,
          placeholder: f.placeholder ?? null,
          pick: !!f.pick,
          set: shown[f.key]!.set,
          display: shown[f.key]!.display,
        })),
        configured: r.configured,
        enabled: r.enabled,
        mode: r.mode,
        source: r.source,
        unreadable: r.unreadable,
        lastCheck: r.lastCheck,
        webhook: hook
          ? {
              url: `${site}${hook.path}${hook.inUrl ? `?token=${canManage ? (r.webhookToken ?? "") : "••••"}` : ""}`,
              how: hook.how,
              token: canManage && hook.tokenEnv && !hook.inUrl ? r.webhookToken : null,
              tokenLabel: hook.tokenLabel ?? null,
              inUrl: !!hook.inUrl,
            }
          : null,
      };
    });

  return (
    <>
      <PageHeader
        title="Integrations"
        description={
          canManage
            ? "Payment gateways, couriers and messages: set each up, test it, and switch it on or off. Keys are stored encrypted and never shown again."
            : "How payments, couriers and messages are set up. Only the owner can change them."
        }
      />
      <IntegrationsView
        data={{
          providers,
          canManage,
          gatewayFirst: settings.integrations.gatewayOrder[0]!,
          payments: settings.payments,
          manualCourierEnabled: settings.shipping.manualCourierEnabled,
          siteUrl: site,
          testAllowed,
        }}
      />
    </>
  );
}

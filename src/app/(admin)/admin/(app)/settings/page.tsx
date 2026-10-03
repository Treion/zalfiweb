import { PageHeader } from "@/components/admin/shell/PageHeader";
import { requireAdmin } from "@/server/auth/session";
import { getAllSettings } from "@/server/settings";
import { mockAllowed, resolveGateway, sslConfig } from "@/server/payments/providers";
import { courierStatuses } from "@/server/shipping/couriers";
import { SettingsTabs } from "./SettingsTabs";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const admin = await requireAdmin("settings.view");
  const settings = await getAllSettings();
  const canEdit = admin.can("settings.manage");
  const ssl = sslConfig();
  const gateway = {
    selected: settings.integrations.payments,
    note: resolveGateway(settings.integrations.payments).note,
    sslcommerz: ssl ? (ssl.live ? "live" : "sandbox") : null,
    mockAllowed: mockAllowed(),
    canChange: admin.can("integrations.manage"),
  } as const;
  return (
    <>
      <PageHeader
        title="Settings"
        description={
          canEdit
            ? "Store details, invoices, shipping, payments and stock. Changes apply at once."
            : "You can read these settings. Only the owner can change them."
        }
      />
      <SettingsTabs
        settings={settings}
        canEdit={canEdit}
        isOwner={admin.can("team.manage")}
        gateway={gateway}
        couriers={courierStatuses()}
      />
    </>
  );
}

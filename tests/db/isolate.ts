import { integrations } from "@/db/schema";
import { clearIntegrationCache } from "@/server/integrations";
import { poolDb } from "@/server/db/pool";

/**
 * Providers set up in the admin (the integrations table) would change what a test sees: a saved
 * webhook token beats the one a test puts in the environment. Each test file starts with the table
 * empty and puts back what was there when it ends.
 */
export function isolateIntegrations() {
  let rows: (typeof integrations.$inferSelect)[] = [];
  return {
    async save() {
      rows = await poolDb().select().from(integrations);
      await poolDb().delete(integrations);
      clearIntegrationCache();
    },
    async restore() {
      await poolDb().delete(integrations);
      if (rows.length) await poolDb().insert(integrations).values(rows);
      clearIntegrationCache();
    },
  };
}

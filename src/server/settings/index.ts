import { eq } from "drizzle-orm";
import { settings } from "@/db/schema";
import { audit, type Actor } from "@/server/audit";
import { poolDb, type Executor } from "@/server/db/pool";
import {
  SETTINGS_KEYS,
  SETTINGS_SCHEMAS,
  parseSettings,
  type Settings,
  type SettingsKey,
} from "./schema";

export * from "./schema";

/** One settings section, complete (defaults fill anything never saved) */
export async function getSettings<K extends SettingsKey>(
  key: K,
  exec: Executor = poolDb(),
): Promise<Settings<K>> {
  const [row] = await exec.select().from(settings).where(eq(settings.key, key)).limit(1);
  return parseSettings(key, row?.value);
}

/** Every section at once */
export async function getAllSettings(exec: Executor = poolDb()) {
  const rows = await exec.select().from(settings);
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(SETTINGS_KEYS.map((k) => [k, parseSettings(k, byKey.get(k))])) as {
    [K in SettingsKey]: Settings<K>;
  };
}

/**
 * Saves a whole section. Strict: unknown fields are rejected, every value is validated. The change
 * is audit-logged with its before and after values.
 */
export async function saveSettings<K extends SettingsKey>(
  key: K,
  value: unknown,
  actor: Actor,
  exec: Executor = poolDb(),
): Promise<Settings<K>> {
  const next = SETTINGS_SCHEMAS[key].strict().parse(value) as Settings<K>;
  const before = await getSettings(key, exec);
  await exec
    .insert(settings)
    .values({ key, value: next, updatedBy: actor.id, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: next, updatedBy: actor.id, updatedAt: new Date() },
    });
  await audit(exec, actor, `settings.${key}.update`, {
    entity: "settings",
    entityId: key,
    before,
    after: next,
  });
  return next;
}

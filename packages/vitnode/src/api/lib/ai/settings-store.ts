import { eq } from "drizzle-orm";

import type { AiDatabase } from "./postgres-ledger";

import { core_ai_settings } from "../../../database/ai";

export type AiSettingsRow = typeof core_ai_settings.$inferInsert;

/** Writes the single settings row, creating it on first save. */
export const saveAiSettings = async (
  db: AiDatabase,
  values: Omit<AiSettingsRow, "id" | "updatedAt">,
): Promise<void> => {
  const [existing] = await db
    .select({ id: core_ai_settings.id })
    .from(core_ai_settings)
    .where(eq(core_ai_settings.id, 1));
  if (existing) {
    await db
      .update(core_ai_settings)
      .set(values)
      .where(eq(core_ai_settings.id, 1));

    return;
  }
  await db
    .insert(core_ai_settings)
    .values({ ...values, id: 1 })
    .onConflictDoUpdate({ set: values, target: core_ai_settings.id });
};

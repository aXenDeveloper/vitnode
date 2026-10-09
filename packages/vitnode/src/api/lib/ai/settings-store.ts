import type { AiDatabase } from "./postgres-ledger";

import { core_ai_settings } from "../../../database/ai";

export type AiSettingsRow = typeof core_ai_settings.$inferInsert;

export const saveAiSettings = async (
  db: AiDatabase,
  values: Omit<AiSettingsRow, "id" | "updatedAt">,
): Promise<void> => {
  await db
    .insert(core_ai_settings)
    .values({ ...values, id: 1 })
    .onConflictDoUpdate({ set: values, target: core_ai_settings.id });
};

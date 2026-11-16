import { gateway } from "ai";

import { decimalFromNumber } from "@/lib/ai/decimal";
import {
  expireAiLeases,
  pruneAiHistory,
  reconcileAiCosts,
} from "@/lib/ai/maintenance";
import { gatewayProviderAdapter } from "@/lib/ai/usage-cost";
import { buildCron } from "@/lib/cron";

const gatewayWithLookup = gatewayProviderAdapter(async id => {
  const info = await gateway.getGenerationInfo({ id });

  return decimalFromNumber(info.totalCost);
});

export const aiMaintenanceCron = buildCron({
  name: "ai-maintenance",
  description:
    "Settle AI runs whose process died, reconcile estimated costs with billed ones, and prune old history",
  schedule: "*/10 * * * *",
  handler: async c => {
    const db = c.get("db");
    await expireAiLeases(db);

    if (
      c.get("core").ai?.models.some(entry => typeof entry.model === "string")
    ) {
      await reconcileAiCosts(db, [
        ...(c.get("core").ai?.providerAdapters ?? []),
        gatewayWithLookup,
      ]);
    }

    const settings = await c.get("ai").ledger().loadSettings();
    await pruneAiHistory(db, settings.historyRetentionDays);
  },
});

import { cleanupContentTranslations } from "@/lib/content-translation/cleanup";
import { buildCron } from "@/lib/cron";

export const contentTranslationCleanupCron = buildCron({
  name: "content-translation-cleanup",
  description:
    "Mark machine translations of edited fields as superseded, purge translations of deleted records, and drop superseded ones past their retention window.",
  schedule: "41 * * * *",
  handler: async c => {
    await cleanupContentTranslations(c);
  },
});

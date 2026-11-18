import { pruneIpAddresses } from "@/lib/account-deletion/ip-retention";
import { buildCron } from "@/lib/cron";

export const ipRetentionCron = buildCron({
  name: "ip-retention",
  description:
    "Forget IP addresses older than users.ipRetentionDays in the API config: delete old debug logs and clear stored IPs",
  schedule: "50 3 * * *",
  handler: async c => {
    await pruneIpAddresses(c.get("db"), {
      retentionDays: c.get("core").privacy.ipRetentionDays,
    });
  },
});

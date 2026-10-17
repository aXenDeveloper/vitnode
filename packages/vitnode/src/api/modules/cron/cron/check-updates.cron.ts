import { buildCron } from "@/api/lib/cron";
import { runUpdateCheckFor } from "@/api/lib/updates/context";

export const checkUpdatesCron = buildCron({
  name: "check_updates",
  description:
    "Check core and plugins for updates and security updates in their public update manifests",
  // Daily at 03:17 in the API server's time zone. A new job has never run, so
  // the first scheduler tick after it is registered runs the first check.
  schedule: "17 3 * * *",
  handler: async c => {
    if (!c.get("core").updates.enabled) return;

    const outcome = await runUpdateCheckFor(c, { manual: false });

    if (outcome.status === "lease_lost") {
      await c
        .get("log")
        .warn(
          "Update check stopped: this instance could not confirm it still holds the update check lease. Results stored before that are kept; the next run checks again.",
        );

      return;
    }

    if (outcome.status !== "completed") {
      // Someone pressed "Check for updates" a moment ago; that run covers this one.
      return;
    }

    if (outcome.summary.failedSources > 0) {
      await c
        .get("log")
        .warn(
          `Update check: ${String(outcome.summary.failedSources)} of ${String(outcome.summary.sources)} update source(s) could not be read. The last valid results are kept.`,
        );
    }
  },
});

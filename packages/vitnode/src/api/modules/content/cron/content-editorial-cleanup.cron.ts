import { buildCron } from "@/api/lib/cron";
import {
  CONTENT_REVISION_MAX_RETENTION,
  CONTENT_SCHEDULE_RETENTION_DAYS,
} from "@/content/const";
import { pruneContentRevisions } from "@/content/server/revisions-model";
import { pruneContentSchedules } from "@/content/server/schedules-model";

const DAY_MS = 24 * 60 * 60 * 1000;

export const contentEditorialCleanupCron = buildCron({
  name: "content-editorial-cleanup",
  description:
    "Remove revisions and schedules for content types that are no longer registered, and settled schedules past their retention window.",
  // 03:20 daily, off the hour so it does not pile onto every other daily job.
  schedule: "20 3 * * *",
  handler: async c => {
    const known = c
      .get("core")
      .contentTypes.filter(entry => entry.definition.editorial.enabled)
      .map(entry => entry.definition.id);

    const schedules = await pruneContentSchedules({
      db: c.get("db"),
      knownContentTypeIds: known,
      olderThan: new Date(
        Date.now() - CONTENT_SCHEDULE_RETENTION_DAYS * DAY_MS,
      ),
    });

    const revisions = await pruneContentRevisions({
      db: c.get("db"),
      knownContentTypeIds: known,
    });

    if (schedules.orphaned + revisions.orphaned === 0) return;

    // Worth saying out loud: an unexpected number here usually means a plugin
    // id or a content type id was renamed without the documented UPDATE.
    await c
      .get("log")
      .debug(
        `[content-editorial-cleanup] removed ${revisions.orphaned} orphaned revisions and ${schedules.orphaned} orphaned schedules (${schedules.settled} settled schedules aged out; revision retention stays capped at ${CONTENT_REVISION_MAX_RETENTION} per record).`,
      );
  },
});

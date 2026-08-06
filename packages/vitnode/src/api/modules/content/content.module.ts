import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { contentEditorialCleanupCron } from "./cron/content-editorial-cleanup.cron";
import { contentScheduleQueueTask } from "./tasks/content-schedule.task";

/**
 * Core's own Content Engine module: the background half.
 *
 * It serves no routes. It exists because `queueTasks` and `cronJobs` are
 * collected from **top-level** modules only, while `buildContentAdminModule` is
 * nested inside a plugin's `admin` module - so a task registered there would be
 * silently dropped, with no error and no handler.
 *
 * One task for every schedulable content type in the install, rather than one
 * per type. The handler resolves the model from `c.get("core").contentModels`,
 * so adding a content type adds no task, no name to collide with, and no
 * registration to forget.
 */
export const contentModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "content",
  routes: [],
  cronJobs: [contentEditorialCleanupCron],
  queueTasks: [contentScheduleQueueTask],
});

import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { contentEditorialCleanupCron } from "./cron/content-editorial-cleanup.cron";
import { contentScheduleEffectsQueueTask } from "./tasks/content-schedule-effects.task";
import { contentScheduleQueueTask } from "./tasks/content-schedule.task";

export const contentModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "content",
  routes: [],
  cronJobs: [contentEditorialCleanupCron],
  queueTasks: [contentScheduleQueueTask, contentScheduleEffectsQueueTask],
});

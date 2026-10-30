import { buildModule } from "@/api/builders";
import { contentLiveWebSocket } from "@/content/server/live/socket";
import { contentRefreshWebSocket } from "@/content/server/refresh/socket";

import { contentEditorialCleanupCron } from "./cron/content-editorial-cleanup.cron";
import { contentNotificationsQueueTask } from "./tasks/content-notifications.task";
import { contentScheduleEffectsQueueTask } from "./tasks/content-schedule-effects.task";
import { contentScheduleQueueTask } from "./tasks/content-schedule.task";
import { contentSearchDependentsQueueTask } from "./tasks/content-search-dependents.task";

export const contentModule = buildModule({
  name: "content",
  routes: [],
  cronJobs: [contentEditorialCleanupCron],
  queueTasks: [
    contentScheduleQueueTask,
    contentScheduleEffectsQueueTask,
    contentSearchDependentsQueueTask,
    contentNotificationsQueueTask,
  ],
  webSockets: [contentLiveWebSocket, contentRefreshWebSocket],
});

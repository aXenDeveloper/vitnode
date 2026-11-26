import { buildModule } from "@/builders";
import { contentLiveWebSocket } from "@/content/server/live/socket";
import { contentRefreshWebSocket } from "@/content/server/refresh/socket";

import { contentEditorialCleanupCron } from "./cron/content-editorial-cleanup.cron";
import { contentSearchAccessCron } from "./cron/content-search-access.cron";
import { contentTranslationCleanupCron } from "./cron/content-translation-cleanup.cron";
import {
  autoTranslateLookupRoute,
  autoTranslatePreferenceRoute,
  autoTranslateRequestRoute,
  autoTranslateSettingsRoute,
} from "./routes/translations.routes";
import { contentMentionsQueueTask } from "./tasks/content-mentions.task";
import { contentNotificationsQueueTask } from "./tasks/content-notifications.task";
import { contentScheduleEffectsQueueTask } from "./tasks/content-schedule-effects.task";
import { contentScheduleQueueTask } from "./tasks/content-schedule.task";
import { contentSearchDependentsQueueTask } from "./tasks/content-search-dependents.task";
import { contentTranslateQueueTask } from "./tasks/content-translate.task";

export const contentModule = buildModule({
  name: "content",
  routes: [
    autoTranslateSettingsRoute,
    autoTranslatePreferenceRoute,
    autoTranslateLookupRoute,
    autoTranslateRequestRoute,
  ],
  cronJobs: [
    contentEditorialCleanupCron,
    contentSearchAccessCron,
    contentTranslationCleanupCron,
  ],
  queueTasks: [
    contentScheduleQueueTask,
    contentScheduleEffectsQueueTask,
    contentSearchDependentsQueueTask,
    contentNotificationsQueueTask,
    contentMentionsQueueTask,
    contentTranslateQueueTask,
  ],
  webSockets: [contentLiveWebSocket, contentRefreshWebSocket],
});

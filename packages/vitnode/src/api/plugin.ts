import type { ApiPluginContract } from "@/lib/fetcher/contract";

import { blocks } from "@/blocks/built-in";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { manifest } from "@/manifest";
import { settingsPage } from "@/views/auth/settings/widgets/settings-page";

import { aiEventDefinitions } from "./events/ai";
import { contentAccessEventDefinitions } from "./events/content-access";
import { contentApprovalEventDefinitions } from "./events/content-approvals";
import { contentContainerEventDefinitions } from "./events/content-containers";
import { fileEventDefinitions } from "./events/files";
import { moderationEventDefinitions } from "./events/moderation";
import { notificationEventDefinitions } from "./events/notifications";
import { pageEventDefinitions } from "./events/pages";
import { paymentEventDefinitions } from "./events/payments";
import { roleEventDefinitions } from "./events/roles";
import { userEventDefinitions } from "./events/users";
import {
  altGenerateAiAction,
  altTranslateAiAction,
} from "./lib/ai/alt-actions";
import {
  editorQuickAskAiAction,
  editorRewriteAiAction,
} from "./lib/ai/editor-actions";
import { buildApiPlugin } from "./lib/plugin";
import { adminModule } from "./modules/admin/admin.module";
import { aiModule } from "./modules/ai/ai.module";
import { contentModule } from "./modules/content/content.module";
import { cronModule } from "./modules/cron/cron.module";
import { middlewareModule } from "./modules/middleware/middleware.module";
import { moderationModule } from "./modules/moderation/moderation.module";
import { notificationsModule } from "./modules/notifications/notifications.module";
import { pagesModule } from "./modules/pages/pages.module";
import { paymentsModule } from "./modules/payments/payments.module";
import { queueModule } from "./modules/queue/queue.module";
import { searchModule } from "./modules/search/search.module";
import { usersModule } from "./modules/users/users.module";

export const newBuildPluginApiCore = buildApiPlugin({
  manifest,
  aiActions: [
    altGenerateAiAction,
    altTranslateAiAction,
    editorRewriteAiAction,
    editorQuickAskAiAction,
  ],
  blocks,
  editablePages: [settingsPage],
  eventDefinitions: [
    ...aiEventDefinitions,
    ...contentAccessEventDefinitions,
    ...contentApprovalEventDefinitions,
    ...contentContainerEventDefinitions,
    ...fileEventDefinitions,
    ...moderationEventDefinitions,
    ...notificationEventDefinitions,
    ...pageEventDefinitions,
    ...paymentEventDefinitions,
    ...roleEventDefinitions,
    ...userEventDefinitions,
  ],
  modules: [
    middlewareModule,
    usersModule,
    moderationModule,
    notificationsModule,
    adminModule,
    aiModule,
    contentModule,
    cronModule,
    pagesModule,
    paymentsModule,
    queueModule,
    searchModule,
  ],
  permissionStaff: coreStaffPermissions,
});

export type VitNodeApiPlugin = ApiPluginContract<typeof newBuildPluginApiCore>;

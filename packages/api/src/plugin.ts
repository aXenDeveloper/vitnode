import type { ApiPluginContract } from "@/lib/fetcher/contract";

import { blockSchemas } from "@/blocks/built-in";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { manifest } from "@/manifest";
import { settingsPage } from "@/modules/pages/settings-page";

import { aiEventDefinitions } from "./events/ai";
import { contentAccessEventDefinitions } from "./events/content-access";
import { contentApprovalEventDefinitions } from "./events/content-approvals";
import { contentContainerEventDefinitions } from "./events/content-containers";
import { fileEventDefinitions } from "./events/files";
import { mcpEventDefinitions } from "./events/mcp";
import { mentionEventDefinitions } from "./events/mentions";
import { moderationEventDefinitions } from "./events/moderation";
import { notificationEventDefinitions } from "./events/notifications";
import { pageEventDefinitions } from "./events/pages";
import { paymentEventDefinitions } from "./events/payments";
import { reactionEventDefinitions } from "./events/reactions";
import { roleEventDefinitions } from "./events/roles";
import { siteEventDefinitions } from "./events/site";
import { userEventDefinitions } from "./events/users";
import { corePersonalData } from "./lib/account-deletion/core-personal-data";
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
import { mcpModule } from "./modules/mcp/mcp.module";
import { middlewareModule } from "./modules/middleware/middleware.module";
import { moderationModule } from "./modules/moderation/moderation.module";
import { notificationsModule } from "./modules/notifications/notifications.module";
import { ogModule } from "./modules/og/og.module";
import { pagesModule } from "./modules/pages/pages.module";
import { paymentsModule } from "./modules/payments/payments.module";
import { queueModule } from "./modules/queue/queue.module";
import { reactionsModule } from "./modules/reactions/reactions.module";
import { searchModule } from "./modules/search/search.module";
import { siteModule } from "./modules/site/site.module";
import { usersModule } from "./modules/users/users.module";

export const newBuildPluginApiCore = buildApiPlugin({
  manifest,
  aiActions: [
    altGenerateAiAction,
    altTranslateAiAction,
    editorRewriteAiAction,
    editorQuickAskAiAction,
  ],
  blocks: blockSchemas,
  editablePages: [settingsPage],
  eventDefinitions: [
    ...aiEventDefinitions,
    ...contentAccessEventDefinitions,
    ...contentApprovalEventDefinitions,
    ...contentContainerEventDefinitions,
    ...fileEventDefinitions,
    ...mcpEventDefinitions,
    ...mentionEventDefinitions,
    ...moderationEventDefinitions,
    ...notificationEventDefinitions,
    ...pageEventDefinitions,
    ...paymentEventDefinitions,
    ...reactionEventDefinitions,
    ...roleEventDefinitions,
    ...siteEventDefinitions,
    ...userEventDefinitions,
  ],
  modules: [
    middlewareModule,
    usersModule,
    moderationModule,
    notificationsModule,
    ogModule,
    adminModule,
    aiModule,
    contentModule,
    cronModule,
    mcpModule,
    pagesModule,
    paymentsModule,
    queueModule,
    reactionsModule,
    searchModule,
    siteModule,
  ],
  permissionStaff: coreStaffPermissions,
  personalData: corePersonalData,
});

export type VitNodeApiPlugin = ApiPluginContract<typeof newBuildPluginApiCore>;

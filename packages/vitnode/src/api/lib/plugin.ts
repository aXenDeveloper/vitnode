import { OpenAPIHono } from "@hono/zod-openapi";

import type { BlockPluginSource } from "@/blocks/types";
import type { AnyEditablePageDefinition } from "@/content/editor/types";
import type { RegisteredContentType } from "@/content/registry";
import type { AnyContentModel } from "@/content/server/model";
import type { AnyContentTypeDefinition } from "@/content/types";
import type { ApiPluginContract } from "@/lib/fetcher/contract";
import type { LocaleMessagesMap } from "@/lib/i18n/types";
import type { NavigationPresetDeclaration } from "@/lib/navigation";

import { BlockError } from "@/blocks/errors";
import { contentPublicUrls } from "@/content/public-urls";
import {
  validateContentTypes,
  withContentPermissions,
} from "@/content/registry";

import type { SearchIndexer } from "../models/search";
import type { AnyAiActionDefinition } from "./ai/action";
import type { CronJobConfig } from "./cron";
import type { RegisteredEditablePage } from "./editable-pages";
import type { EventListenerConfig } from "./events";
import type { BaseBuildModuleReturn, BuildModuleReturn } from "./module";
import type { AnyNotificationTypeDefinition } from "./notifications/registry";
import type { PermissionStaffConfig } from "./permission-staff";
import type { QueueTaskConfig } from "./queue";
import type { WebSocketConfig } from "./websocket";

import { validateSearchIndexers } from "../models/search";
import { collectAiActions } from "./ai/registry";
import { checkPluginId } from "./check-plugin-id";
import { registerEditablePage, validateEditablePages } from "./editable-pages";
import { collectNavigationPresets } from "./navigation-presets";
import { validateNotificationTypes } from "./notifications/registry";
import { applyModuleTags } from "./openapi-tags";

export type { ApiPluginContract };

export interface BuildPluginApiReturn<
  P extends string = string,
  Modules extends readonly BaseBuildModuleReturn<P>[] =
    readonly BaseBuildModuleReturn<P>[],
> {
  aiActions?: AnyAiActionDefinition[];
  blocks?: BlockPluginSource;
  contentModels?: AnyContentModel[];
  contentTypes?: AnyContentTypeDefinition[];
  cronJobs?: Omit<CronJobConfig, "pluginId">[];
  editablePages?: AnyEditablePageDefinition[];
  events?: Omit<EventListenerConfig, "pluginId">[];
  hono: OpenAPIHono;
  messages?: LocaleMessagesMap;
  modules: Modules;
  navigation?: NavigationPresetDeclaration[];
  notificationTypes?: AnyNotificationTypeDefinition[];
  openApiTags?: string[];
  permissionStaff?: PermissionStaffConfig;
  pluginId: P;
  publicContentTypes?: AnyContentTypeDefinition[];
  queueTasks?: Omit<QueueTaskConfig, "pluginId">[];
  searchIndexers?: SearchIndexer[];
  webSockets?: Omit<WebSocketConfig, "pluginId">[];
}

export type AnyBuildPluginApiReturn = BuildPluginApiReturn<
  string,
  readonly BaseBuildModuleReturn[]
>;

export function buildApiPlugin<
  const P extends string,
  const Modules extends readonly BuildModuleReturn<P, string>[] = readonly [],
>({
  aiActions,
  blocks,
  editablePages,
  pluginId,
  messages,
  modules = [] as unknown as Modules,
  navigation,
  notificationTypes,
  permissionStaff,
  searchIndexers,
}: {
  aiActions?: AnyAiActionDefinition[];
  blocks?: BlockPluginSource;
  editablePages?: AnyEditablePageDefinition[];
  messages?: LocaleMessagesMap;
  modules?: Modules;
  navigation?: NavigationPresetDeclaration[];
  notificationTypes?: AnyNotificationTypeDefinition[];
  permissionStaff?: PermissionStaffConfig;
  pluginId: P;
  searchIndexers?: SearchIndexer[];
}): BuildPluginApiReturn<P, Modules> {
  // Run for checking if the plugin is valid
  checkPluginId(pluginId);

  if (blocks && blocks.pluginId !== pluginId) {
    throw new BlockError(
      `Plugin "${pluginId}" registers the blocks module of "${blocks.pluginId}". Pass the object the plugin's own \`blocks\` module exports, so the API and the browser namespace them identically.`,
    );
  }

  // Refused here as well as across every plugin: one plugin declaring a page id
  // twice is its own mistake, and it reads better named by the plugin that made
  // it than as an installation-wide collision.
  const registeredPages: RegisteredEditablePage[] = validateEditablePages(
    (editablePages ?? []).map(page => registerEditablePage(page, pluginId)),
  );

  collectNavigationPresets([{ navigation, pluginId }]);

  collectAiActions([{ aiActions, pluginId }]);

  const hono = new OpenAPIHono();
  const contentModels: AnyContentModel[] = [];
  const contentTypes: AnyContentTypeDefinition[] = [];
  const publicContentTypes: AnyContentTypeDefinition[] = [];
  const cronJobs: BuildPluginApiReturn["cronJobs"] = [];
  const events: BuildPluginApiReturn["events"] = [];
  const indexers: SearchIndexer[] = [...(searchIndexers ?? [])];
  const pluginNotificationTypes: AnyNotificationTypeDefinition[] = [
    ...(notificationTypes ?? []),
  ];
  const openApiTags: string[] = [];
  const queueTasks: BuildPluginApiReturn["queueTasks"] = [];
  const webSockets: BuildPluginApiReturn["webSockets"] = [];
  modules.forEach(handler => {
    openApiTags.push(...applyModuleTags(handler, pluginId));

    hono.route(`/${handler.name}`, handler.hono);

    contentModels.push(...collectContentModels(handler));
    contentTypes.push(...collectContentTypes(handler));
    publicContentTypes.push(...collectPublicContentTypes(handler));
    indexers.push(...collectSearchIndexers(handler));
    pluginNotificationTypes.push(
      ...collectModuleTree(handler, m => m.notificationTypes),
    );

    handler.cronJobs?.forEach(cron => {
      cronJobs.push({ ...cron, module: handler.name });
    });

    handler.events?.forEach(listener => {
      events.push({ ...listener, module: handler.name });
    });

    handler.queueTasks?.forEach(task => {
      queueTasks.push({ ...task, module: handler.name });
    });

    handler.webSockets?.forEach(webSocket => {
      webSockets.push({ ...webSocket, module: handler.name });
    });
  });

  const registered: RegisteredContentType[] = validateContentTypes(
    contentTypes.map(definition => ({ definition, pluginId })),
  );

  validateSearchIndexers(indexers.map(indexer => ({ ...indexer, pluginId })));

  validateNotificationTypes(
    pluginNotificationTypes.map(definition => ({ definition, pluginId })),
  );

  const publishing = new Map<string, AnyContentTypeDefinition>();
  for (const definition of [
    ...registered.map(entry => entry.definition),
    ...publicContentTypes,
  ]) {
    if (contentPublicUrls(definition).length > 0) {
      publishing.set(definition.id, definition);
    }
  }

  return {
    pluginId,
    aiActions,
    blocks,
    editablePages: registeredPages.map(entry => entry.page),
    messages,
    modules,
    navigation,
    hono,
    openApiTags: [...new Set(openApiTags)],
    contentModels,
    contentTypes: registered.map(entry => entry.definition),
    publicContentTypes: [...publishing.values()],
    cronJobs,
    events,
    queueTasks,
    notificationTypes: pluginNotificationTypes,
    searchIndexers: indexers,
    webSockets,
    // Every content type contributes can_view/can_create/can_edit/can_delete
    // unless the plugin declared that module itself.
    permissionStaff: withContentPermissions(permissionStaff, registered),
  };
}

/**
 * Walks the whole module tree. Content types are collected recursively - unlike
 * `events`, `cronJobs` and friends, which only come from top-level modules - so
 * a generated content module can be nested inside the plugin's `admin` module
 * and still register its permissions.
 */
function collectContentTypes(
  module: BaseBuildModuleReturn,
): AnyContentTypeDefinition[] {
  return [
    ...(module.contentTypes ?? []),
    ...(module.modules ?? []).flatMap(collectContentTypes),
  ];
}

function collectPublicContentTypes(
  module: BaseBuildModuleReturn,
): AnyContentTypeDefinition[] {
  return [
    ...(module.publicContentTypes ?? []),
    ...(module.modules ?? []).flatMap(collectPublicContentTypes),
  ];
}

/** Same walk as {@link collectContentTypes}, and for the same reason. */
function collectContentModels(
  module: BaseBuildModuleReturn,
): AnyContentModel[] {
  return [
    ...(module.contentModels ?? []),
    ...(module.modules ?? []).flatMap(collectContentModels),
  ];
}

function collectSearchIndexers(module: BaseBuildModuleReturn): SearchIndexer[] {
  return [
    ...(module.searchIndexers ?? []),
    ...(module.modules ?? []).flatMap(collectSearchIndexers),
  ];
}

function collectModuleTree<T>(
  module: BaseBuildModuleReturn,
  pick: (module: BaseBuildModuleReturn) => T[] | undefined,
): T[] {
  return [
    ...(pick(module) ?? []),
    ...(module.modules ?? []).flatMap(child => collectModuleTree(child, pick)),
  ];
}

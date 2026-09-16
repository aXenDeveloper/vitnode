import { OpenAPIHono } from "@hono/zod-openapi";

import type { BlockPluginSource } from "@/blocks/types";
import type { RegisteredContentType } from "@/content/registry";
import type { AnyContentModel } from "@/content/server/model";
import type { AnyContentTypeDefinition } from "@/content/types";
import type { ApiPluginContract } from "@/lib/fetcher/contract";
import type { LocaleMessagesMap } from "@/lib/i18n/types";

import { BlockError } from "@/blocks/errors";
import {
  validateContentTypes,
  withContentPermissions,
} from "@/content/registry";

import type { SearchIndexer } from "../models/search";
import type { CronJobConfig } from "./cron";
import type { EventListenerConfig } from "./events";
import type { BaseBuildModuleReturn, BuildModuleReturn } from "./module";
import type { PermissionStaffConfig } from "./permission-staff";
import type { QueueTaskConfig } from "./queue";
import type { WebSocketConfig } from "./websocket";

import { validateSearchIndexers } from "../models/search";
import { checkPluginId } from "./check-plugin-id";
import { applyModuleTags } from "./openapi-tags";

export type { ApiPluginContract };

export interface BuildPluginApiReturn<
  P extends string = string,
  Modules extends readonly BaseBuildModuleReturn<P>[] =
    readonly BaseBuildModuleReturn<P>[],
> {
  blocks?: BlockPluginSource;
  contentModels?: AnyContentModel[];
  contentTypes?: AnyContentTypeDefinition[];
  cronJobs?: Omit<CronJobConfig, "pluginId">[];
  events?: Omit<EventListenerConfig, "pluginId">[];
  hono: OpenAPIHono;
  messages?: LocaleMessagesMap;
  modules: Modules;
  openApiTags?: string[];
  permissionStaff?: PermissionStaffConfig;
  pluginId: P;
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
  blocks,
  pluginId,
  messages,
  modules = [] as unknown as Modules,
  permissionStaff,
  searchIndexers,
}: {
  blocks?: BlockPluginSource;
  messages?: LocaleMessagesMap;
  modules?: Modules;
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

  const hono = new OpenAPIHono();
  const contentModels: AnyContentModel[] = [];
  const contentTypes: AnyContentTypeDefinition[] = [];
  const cronJobs: BuildPluginApiReturn["cronJobs"] = [];
  const events: BuildPluginApiReturn["events"] = [];
  const indexers: SearchIndexer[] = [...(searchIndexers ?? [])];
  const openApiTags: string[] = [];
  const queueTasks: BuildPluginApiReturn["queueTasks"] = [];
  const webSockets: BuildPluginApiReturn["webSockets"] = [];
  modules.forEach(handler => {
    openApiTags.push(...applyModuleTags(handler, pluginId));

    hono.route(`/${handler.name}`, handler.hono);

    contentModels.push(...collectContentModels(handler));
    contentTypes.push(...collectContentTypes(handler));
    indexers.push(...collectSearchIndexers(handler));

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

  return {
    pluginId,
    blocks,
    messages,
    modules,
    hono,
    openApiTags: [...new Set(openApiTags)],
    contentModels,
    contentTypes: registered.map(entry => entry.definition),
    cronJobs,
    events,
    queueTasks,
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

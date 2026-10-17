import { OpenAPIHono } from "@hono/zod-openapi";

import type { BlockPluginSource } from "@/blocks/types";
import type { AnyContentContainerDefinition } from "@/content/containers/types";
import type { AnyEditablePageDefinition } from "@/content/editor/types";
import type { RegisteredContentType } from "@/content/registry";
import type { AnyContentModel } from "@/content/server/model";
import type { AnyContentTypeDefinition } from "@/content/types";
import type { ApiPluginContract } from "@/lib/fetcher/contract";
import type { LocaleMessagesMap } from "@/lib/i18n/types";
import type { PluginManifest } from "@/lib/plugin-manifest";

import { BlockError } from "@/blocks/errors";
import {
  assertContentContainerNamespaces,
  contentContainerPermissionEntries,
  validateContentContainers,
} from "@/content/containers/registry";
import { contentContainerModerationScope } from "@/content/containers/server/scope";
import { contentPublicUrls } from "@/content/public-urls";
import {
  validateContentTypes,
  withContentPermissions,
} from "@/content/registry";
import { contentDefinitionOf } from "@/content/server/model";
import { contentReportTarget } from "@/content/server/report-target";
import { assertPluginManifest } from "@/lib/plugin-manifest";

import type { SearchIndexer } from "../models/search";
import type { AnyAiActionDefinition } from "./ai/action";
import type { CronJobConfig } from "./cron";
import type { RegisteredEditablePage } from "./editable-pages";
import type { EventListenerConfig } from "./events";
import type { ModerationPluginConfig } from "./moderation/registry";
import type { ModerationReportTargetDefinition } from "./moderation/targets";
import type { BaseBuildModuleReturn, BuildModuleReturn } from "./module";
import type { AnyNotificationTypeDefinition } from "./notifications/registry";
import type { PermissionStaffConfig } from "./permission-staff";
import type { QueueTaskConfig } from "./queue";
import type { WebSocketConfig } from "./websocket";

import { validateSearchIndexers } from "../models/search";
import { collectAiActions } from "./ai/registry";
import { checkPluginId } from "./check-plugin-id";
import { registerEditablePage, validateEditablePages } from "./editable-pages";
import { withModerationPermissions } from "./moderation/registry";
import { validateNotificationTypes } from "./notifications/registry";
import { applyModuleTags } from "./openapi-tags";

export type { ApiPluginContract };

/**
 * A plugin's API half, as {@link buildApiPlugin} returns it and an app's
 * `buildApiConfig({ plugins })` mounts it at `/{pluginId}` under the API's
 * base path (`/api` in the starter apps).
 *
 * Everything the modules declared is already collected and validated here:
 * content types, models and containers from the whole module tree; cron jobs,
 * event listeners, queue tasks and WebSockets from top-level modules only, each
 * stamped with the module that declared it.
 */
export interface BuildPluginApiReturn<
  P extends string = string,
  Modules extends readonly BaseBuildModuleReturn<P>[] =
    readonly BaseBuildModuleReturn<P>[],
> {
  aiActions?: AnyAiActionDefinition[];
  blocks?: BlockPluginSource;
  contentContainers?: AnyContentContainerDefinition[];
  contentModels?: AnyContentModel[];
  contentTypes?: AnyContentTypeDefinition[];
  cronJobs?: Omit<CronJobConfig, "pluginId">[];
  editablePages?: AnyEditablePageDefinition[];
  events?: Omit<EventListenerConfig, "pluginId">[];
  /** Every module's routes, each module mounted at `/{module.name}`. */
  hono: OpenAPIHono;
  manifest?: PluginManifest<P>;
  messages?: LocaleMessagesMap;
  /** Declared targets and scopes, plus one report target per content model with reports enabled. */
  moderation?: Required<ModerationPluginConfig>;
  /** The module tuple as passed in; the fetcher's types resolve calls through it. */
  modules: Modules;
  notificationTypes?: AnyNotificationTypeDefinition[];
  openApiTags?: string[];
  /** The declared permissions, plus the ones content types, containers and report targets add. */
  permissionStaff?: PermissionStaffConfig;
  /** The plugin's npm package name, taken from `manifest.id`. */
  pluginId: P;
  /** Content types the plugin serves public URLs for. */
  publicContentTypes?: AnyContentTypeDefinition[];
  queueTasks?: Omit<QueueTaskConfig, "pluginId">[];
  searchIndexers?: SearchIndexer[];
  webSockets?: Omit<WebSocketConfig, "pluginId">[];
}

export type AnyBuildPluginApiReturn = BuildPluginApiReturn<
  string,
  readonly BaseBuildModuleReturn[]
>;

/**
 * Declares a plugin's API half: its Hono modules plus everything they bring -
 * content types, cron jobs, events, queues, notifications, WebSockets, staff
 * permissions. Its frontend half is `buildPlugin` from
 * `@vitnode/core/lib/plugin`; both take the plugin's generated manifest, whose
 * `id` (the package name) keys every registration.
 *
 * Server-only. Call it from the plugin's `src/config.api.ts`, which an app
 * imports in its `vitnode.api.config.ts` and nowhere a browser bundle reaches.
 *
 * Staff permissions: every content type adds `can_view`, `can_create`,
 * `can_edit` and `can_delete` under its permission module, every content
 * container and report target adds its own entries, unless `permissionStaff`
 * already declares that module.
 *
 * @throws When `manifest` is malformed; when `blocks` belongs to another
 * plugin; when content types, containers, editable pages, AI actions, search
 * indexers or notification types are invalid or collide. In development, also
 * when no installed package's `package.json` has the plugin id as its name.
 *
 * @example
 * ```ts
 * // src/config.api.ts
 * import type { ApiPluginContract } from "@vitnode/core/api/lib/plugin";
 *
 * import { buildApiPlugin } from "@vitnode/core/api/lib/plugin";
 *
 * import { postsModule } from "@/api/modules/posts/posts.module";
 * import { manifest } from "@/manifest.gen";
 *
 * export const blogApiPlugin = () =>
 *   buildApiPlugin({ manifest, modules: [postsModule] });
 *
 * // What the fetcher's registry reads to type calls to this plugin.
 * export type VitNodeApiPlugin = ApiPluginContract<ReturnType<typeof blogApiPlugin>>;
 * ```
 */
export function buildApiPlugin<
  const P extends string,
  const Modules extends readonly BuildModuleReturn<P, string>[] = readonly [],
>({
  aiActions,
  blocks,
  editablePages,
  manifest,
  messages,
  moderation,
  modules = [] as unknown as Modules,
  notificationTypes,
  permissionStaff,
  searchIndexers,
}: {
  /** AI actions admins can run, e.g. from an editor. */
  aiActions?: AnyAiActionDefinition[];
  /** The object the plugin's own widgets (`blocks`) module exports; its `pluginId` must match. */
  blocks?: BlockPluginSource;
  /** Pages built from widgets that admins edit in place. Page ids must be unique within the plugin. */
  editablePages?: AnyEditablePageDefinition[];
  /** The plugin's generated manifest (`src/manifest.gen.ts`). */
  manifest: PluginManifest<P>;
  /**
   * Lazy loaders for the plugin's server-side messages (emails, notifications),
   * keyed by locale code. Separate from the frontend tree `buildPlugin` takes.
   */
  messages?: LocaleMessagesMap;
  /** Report targets and moderation scopes beyond those content models add. */
  moderation?: ModerationPluginConfig;
  /** Top-level modules, each mounted at `/{pluginId}/{name}` under the API's base path. */
  modules?: Modules;
  /** Notification types in addition to those modules declare. */
  notificationTypes?: AnyNotificationTypeDefinition[];
  /** Staff permissions the plugin's routes check, grouped by permission module. */
  permissionStaff?: PermissionStaffConfig;
  /** Search indexers in addition to those modules declare. */
  searchIndexers?: SearchIndexer[];
}): BuildPluginApiReturn<P, Modules> {
  const pluginId = manifest.id;
  // Run for checking if the plugin is valid
  checkPluginId(pluginId);
  assertPluginManifest(pluginId, manifest, "buildApiPlugin()");

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

  collectAiActions([{ aiActions, pluginId }]);

  const hono = new OpenAPIHono();
  const contentContainers: AnyContentContainerDefinition[] = [];
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

    contentContainers.push(
      ...collectModuleTree(handler, m => m.contentContainers),
    );
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

  const registeredContainers = validateContentContainers(
    contentContainers.map(definition => ({ definition, pluginId })),
  ).map(entry => entry.definition);
  assertContentContainerNamespaces({
    containers: registeredContainers,
    contentTypes: [
      ...registered.map(entry => entry.definition),
      ...publicContentTypes,
    ],
    pluginId,
  });

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

  const reportTargets: ModerationReportTargetDefinition[] = [
    ...(moderation?.reportTargets ?? []),
    ...contentModels
      .filter(model => contentDefinitionOf(model).reports.enabled)
      .map(model => contentReportTarget(model, pluginId)),
  ];

  return {
    pluginId,
    aiActions,
    blocks,
    editablePages: registeredPages.map(entry => entry.page),
    manifest,
    messages,
    modules,
    hono,
    openApiTags: [...new Set(openApiTags)],
    contentContainers: registeredContainers,
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
    permissionStaff: withModerationPermissions(
      withContainerPermissions(
        withContentPermissions(permissionStaff, registered, publicContentTypes),
        registeredContainers,
      ),
      reportTargets,
      new Set(Object.keys(permissionStaff?.moderator ?? {})),
    ),
    moderation: {
      reportTargets,
      scopes: [
        ...(moderation?.scopes ?? []),
        ...registeredContainers
          .filter(definition => definition.policies.enabled)
          .map(definition =>
            contentContainerModerationScope(definition, pluginId),
          ),
      ],
    },
  };
}

function withContainerPermissions(
  permissionStaff: PermissionStaffConfig | undefined,
  containers: readonly AnyContentContainerDefinition[],
): PermissionStaffConfig | undefined {
  if (containers.length === 0) return permissionStaff;

  const admin = { ...permissionStaff?.admin };
  for (const definition of containers) {
    admin[definition.admin.permissionModule] ??=
      contentContainerPermissionEntries();
  }

  return { ...permissionStaff, admin };
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

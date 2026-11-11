import type { z } from "zod";

import type { PluginManifest } from "@/lib/plugin-manifest";

import type { CacheEntryDefinition, CacheEntryOptions } from "./cache-entry";
import type {
  EventDefinition,
  EventDefinitionOptions,
} from "./event-definition";
import type {
  BaseBuildModuleReturn,
  BuildModuleOptions,
  BuildModuleReturn,
} from "./module";
import type { QueueTaskDefinition, QueueTaskOptions } from "./queue";
import type { BuildRouteConfig, BuildRouteOptions, Route } from "./route";

import { defineCacheEntry } from "./cache-entry";
import { defineEvent } from "./event-definition";
import { buildModule } from "./module";
import { buildQueueTask } from "./queue";
import { buildRoute } from "./route";

/**
 * Binds the builders to one plugin, so what they build carries the plugin id
 * without repeating it: routes (for OpenAPI tags, `c.get("plugin")`,
 * staff-permission checks and the fetcher's type inference), queue tasks
 * (whose rows are stored under it), typed cache entries (whose keys
 * are) and event definitions (which it owns).
 *
 * Call it once per plugin, in a builders module the plugin's API code imports.
 * Server-only.
 *
 * @example
 * ```ts
 * // src/api/builders.ts
 * import { bindApiPlugin } from "@vitnode/core/api/lib/bind-api-plugin";
 *
 * import { manifest } from "@/manifest.gen";
 *
 * const apiBuilders = bindApiPlugin(manifest);
 *
 * export const buildModule = apiBuilders.buildModule;
 * export const buildRoute = apiBuilders.buildRoute;
 * export const buildQueueTask = apiBuilders.buildQueueTask;
 * export const defineCacheEntry = apiBuilders.defineCacheEntry;
 * export const defineEvent = apiBuilders.defineEvent;
 * ```
 */
export const bindApiPlugin = <const Plugin extends string>(
  manifest: Pick<PluginManifest<Plugin>, "id">,
) => ({
  /** {@link buildModule}, with this plugin's id filled in. */
  buildModule: <
    const M extends string,
    const Routes extends Route<Plugin>[],
    Modules extends BaseBuildModuleReturn<Plugin>[],
  >(
    options: BuildModuleOptions<Plugin, M, Routes, Modules>,
  ): BuildModuleReturn<Plugin, M, Routes, Modules> =>
    buildModule<Plugin, M, Routes, Modules>({
      ...options,
      pluginId: manifest.id,
    }),
  /** {@link buildQueueTask}, with this plugin's id filled in. */
  buildQueueTask: <const Name extends string, Schema extends z.ZodType>(
    options: Omit<QueueTaskOptions<Plugin, Name, Schema>, "pluginId">,
  ): QueueTaskDefinition<Plugin, Name, Schema> =>
    buildQueueTask<Plugin, Name, Schema>({ ...options, pluginId: manifest.id }),
  /** {@link buildRoute}, with this plugin's id filled in. */
  buildRoute: <P extends string, R extends BuildRouteConfig<P>>(
    options: BuildRouteOptions<P, R>,
  ): Route<Plugin, R & { path: P }> =>
    buildRoute<Plugin, P, R>({ ...options, pluginId: manifest.id }),
  /** {@link defineCacheEntry}, with this plugin's id filled in. */
  defineCacheEntry: <
    const Name extends string,
    Schema extends z.ZodType,
    const Args extends readonly unknown[] = [],
  >(
    options: Omit<CacheEntryOptions<Plugin, Name, Args, Schema>, "pluginId">,
  ): CacheEntryDefinition<Plugin, Name, Args, Schema> =>
    defineCacheEntry<Plugin, Name, Schema, Args>({
      ...options,
      pluginId: manifest.id,
    }),
  /** {@link defineEvent}, with this plugin's id filled in. */
  defineEvent: <const Name extends string, Schema extends z.ZodType>(
    options: Omit<EventDefinitionOptions<Plugin, Name, Schema>, "pluginId">,
  ): EventDefinition<Plugin, Name, Schema> =>
    defineEvent<Plugin, Name, Schema>({ ...options, pluginId: manifest.id }),
});

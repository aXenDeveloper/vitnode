import type { AnyContentContainerDefinition } from "@vitnode/api/content/containers/types";
import type { AnyContentTypeDefinition } from "@vitnode/api/content/types";

import { validateContentContainers } from "@vitnode/api/content/containers/registry";
import { ContentEngineError } from "@vitnode/api/content/errors";
import { validateContentTypes } from "@vitnode/api/content/registry";

import type {
  ContentContainerFrontendRegistration,
  ContentFrontendPluginSource,
  ContentTypeFrontendRegistration,
} from "../../lib/plugin";
import type { ContentTypeLookup } from "./route";

/** A content type's frontend registration, plus the plugin that registered it. */
export interface RegisteredFrontendContentType {
  definition: AnyContentTypeDefinition;
  pluginId: string;
  registration: ContentTypeFrontendRegistration;
}

export interface RegisteredFrontendContentContainer {
  definition: AnyContentContainerDefinition;
  pluginId: string;
  registration: ContentContainerFrontendRegistration;
}

export interface ContentContainerFrontendRegistry {
  all: () => readonly RegisteredFrontendContentContainer[];
  byAdminPath: (
    adminPath: string,
  ) => RegisteredFrontendContentContainer | undefined;
  byId: (
    definitionId: string,
  ) => RegisteredFrontendContentContainer | undefined;
}

/** Lookups over every content type the installed plugins register for the AdminCP. */
export interface ContentFrontendRegistry {
  /** Every registration, sorted by content type id. */
  all: () => readonly RegisteredFrontendContentType[];
  /** By `admin.path` - the URL's own name for the content type. */
  byAdminPath: (adminPath: string) => RegisteredFrontendContentType | undefined;
  /** By `definition.id` - `blog.post`. */
  byId: (contentTypeId: string) => RegisteredFrontendContentType | undefined;
  containers: ContentContainerFrontendRegistry;

  lookup: ContentTypeLookup;
}

const buildContainerRegistry = (
  plugins: readonly ContentFrontendPluginSource[],
): ContentContainerFrontendRegistry => {
  const entries = plugins.flatMap(plugin =>
    (plugin.containers ?? []).map(registration => ({
      definition: registration.definition,
      pluginId: plugin.pluginId,
      registration,
    })),
  );

  const firstRegistrations = new Set(validateContentContainers(entries));
  const all = entries
    .filter(entry => firstRegistrations.has(entry))
    .sort((a, b) => a.definition.id.localeCompare(b.definition.id));

  const byId = new Map(all.map(entry => [entry.definition.id, entry]));
  const byAdminPath = new Map(
    all.map(entry => [entry.definition.admin.path, entry]),
  );

  return {
    all: () => all,
    byAdminPath: adminPath => byAdminPath.get(adminPath),
    byId: definitionId => byId.get(definitionId),
  };
};

/**
 * Collects the `contentTypes` and `containers` of every frontend plugin
 * (`buildPlugin()`) into one registry. Called by the app's generated
 * `src/content-registry.gen.ts`; plugin code rarely needs it.
 *
 * @throws A `ContentEngineError` when two content types clash - the same id,
 * table, admin path or delivery path - as `validateContentTypes` reports, or
 * when a container and a content type share an admin path.
 */
export const buildContentFrontendRegistry = (
  plugins: readonly ContentFrontendPluginSource[],
): ContentFrontendRegistry => {
  const entries = plugins.flatMap(plugin =>
    (plugin.contentTypes ?? []).map(registration => ({
      definition: registration.definition,
      pluginId: plugin.pluginId,
      registration,
    })),
  );

  validateContentTypes(
    entries.map(({ definition, pluginId }) => ({ definition, pluginId })),
  );

  const all = [...entries].sort((a, b) =>
    a.definition.id.localeCompare(b.definition.id),
  );

  const byId = new Map(all.map(entry => [entry.definition.id, entry]));
  const byAdminPath = new Map(
    all.map(entry => [entry.definition.admin.path, entry]),
  );

  const containers = buildContainerRegistry(plugins);
  for (const container of containers.all()) {
    const contentType = byAdminPath.get(container.definition.admin.path);
    if (contentType) {
      throw new ContentEngineError(
        `AdminCP path "${container.definition.admin.path}" is claimed by both the content type ${contentType.pluginId} -> ${contentType.definition.id} and the container ${container.pluginId} -> ${container.definition.id}. One catch-all route serves /admin/${container.definition.admin.path} - give one a different \`admin.path\`.`,
        { contentTypeId: container.definition.id },
      );
    }
  }

  return {
    all: () => all,
    byAdminPath: adminPath => byAdminPath.get(adminPath),
    byId: contentTypeId => byId.get(contentTypeId),
    containers,
    lookup: adminPath => byAdminPath.get(adminPath)?.definition,
  };
};

export const CONTENT_FRONTEND_REGISTRY_MISSING =
  "No Content Engine registry is registered. src/content-registry.gen.ts calls setContentFrontendRegistry() when it is evaluated, so the application has to load that module before any AdminCP content route runs - the router's `loadContentRegistry` import is what does it.";

let registered: ContentFrontendRegistry | undefined;

/** Installs the app-wide registry. Done by the generated `src/content-registry.gen.ts`. */
export const setContentFrontendRegistry = (
  registry: ContentFrontendRegistry,
): void => {
  registered = registry;
};

/** The registered registry, or a failure that says what is missing. */
export const contentFrontendRegistry = (): ContentFrontendRegistry => {
  if (!registered) throw new Error(CONTENT_FRONTEND_REGISTRY_MISSING);

  return registered;
};

/** Whether an application has registered one yet. For tests. */
export const hasContentFrontendRegistry = (): boolean =>
  registered !== undefined;

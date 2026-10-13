import type {
  ContentContainerFrontendRegistration,
  ContentFrontendPluginSource,
  ContentTypeFrontendRegistration,
} from "../../lib/plugin";
import type { AnyContentContainerDefinition } from "../containers/types";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentTypeLookup } from "./route";

import { validateContentContainers } from "../containers/registry";
import { validateContentTypes } from "../registry";

/** A content type's frontend registration, plus the plugin that registered it. */
export interface RegisteredFrontendContentType {
  definition: AnyContentTypeDefinition;
  pluginId: string;
  registration: ContentTypeFrontendRegistration;
}

/** A container collection's frontend registration, plus the plugin that registered it. */
export interface RegisteredFrontendContentContainer {
  definition: AnyContentContainerDefinition;
  pluginId: string;
  registration: ContentContainerFrontendRegistration;
}

export interface ContentContainerFrontendRegistry {
  /** Every collection, sorted by definition id. */
  all: () => readonly RegisteredFrontendContentContainer[];
  /** By `admin.path` - `/admin/containers/{path}`. */
  byAdminPath: (
    adminPath: string,
  ) => RegisteredFrontendContentContainer | undefined;
  /** By `definition.id` - `example.boards`. */
  byId: (
    definitionId: string,
  ) => RegisteredFrontendContentContainer | undefined;
}

export interface ContentFrontendRegistry {
  /** Every registration, sorted by content type id. */
  all: () => readonly RegisteredFrontendContentType[];
  /** By `admin.path` - the URL's own name for the content type. */
  byAdminPath: (adminPath: string) => RegisteredFrontendContentType | undefined;
  /** By `definition.id` - `blog.post`. */
  byId: (contentTypeId: string) => RegisteredFrontendContentType | undefined;
  /** Container collections (`defineContentContainer`) the plugins registered. */
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

  const valid = new Set(
    validateContentContainers(
      entries.map(({ definition, pluginId }) => ({ definition, pluginId })),
    ).map(entry => entry.definition),
  );

  // `validateContentContainers` folds a definition registered twice by one
  // plugin into one; the first registration's icon wins.
  const seen = new Set<string>();
  const all = entries
    .filter(entry => {
      if (!valid.has(entry.definition) || seen.has(entry.definition.id)) {
        return false;
      }
      seen.add(entry.definition.id);

      return true;
    })
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

  return {
    all: () => all,
    byAdminPath: adminPath => byAdminPath.get(adminPath),
    byId: contentTypeId => byId.get(contentTypeId),
    containers: buildContainerRegistry(plugins),
    lookup: adminPath => byAdminPath.get(adminPath)?.definition,
  };
};

export const CONTENT_FRONTEND_REGISTRY_MISSING =
  "No Content Engine registry is registered. src/content-registry.gen.ts calls setContentFrontendRegistry() when it is evaluated, so the application has to load that module before any /admin/content route runs - the router's `loadContentRegistry` import is what does it.";

let registered: ContentFrontendRegistry | undefined;

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

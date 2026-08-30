import type {
  ContentFrontendPluginSource,
  ContentTypeFrontendRegistration,
} from "../../lib/plugin";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentTypeLookup } from "./route";

import { validateContentTypes } from "../registry";

/**
 * The Content Engine's frontend registry - one implementation, two doors.
 *
 * Everything here is plain data and component *references*: no `next/*`, no
 * server config, no filesystem, no `import(variable)`. That is what lets the
 * same registry serve the Next.js AdminCP, which builds it from
 * `getVitNodeConfig().plugins`, and the TanStack Start AdminCP, which builds it
 * from a generated module of literal imports. See `./config.ts` for the first
 * and `framework/content-registry` for the second.
 *
 * There is deliberately no second registry beside this one. The two hosts differ
 * only in *where the plugin list comes from*; every rule about what a valid
 * registration is, which path addresses it and what makes two of them
 * incompatible lives here and in `content/registry.ts`.
 */

/** A content type's frontend registration, plus the plugin that registered it. */
export interface RegisteredFrontendContentType {
  definition: AnyContentTypeDefinition;
  pluginId: string;
  registration: ContentTypeFrontendRegistration;
}

/**
 * Every content type an installation registered, indexed the three ways
 * anything asks for one.
 *
 * Built once and read many times, rather than derived per call: validation is
 * O(content types x fields x indexes), and the list screen, the breadcrumb, the
 * metadata and every form resolve a content type on the same navigation.
 */
export interface ContentFrontendRegistry {
  /** Every registration, sorted by content type id. */
  all: () => readonly RegisteredFrontendContentType[];
  /** By `admin.path` - the URL's own name for the content type. */
  byAdminPath: (adminPath: string) => RegisteredFrontendContentType | undefined;
  /** By `definition.id` - `blog.post`. */
  byId: (contentTypeId: string) => RegisteredFrontendContentType | undefined;
  /**
   * The predicate `resolveContentAdminRoute` takes.
   *
   * Exposed as its own member rather than left to callers to write, because the
   * resolver is keyed by `admin.path` and a caller that reached for `byId`
   * instead would silently break every content type whose path and id disagree.
   */
  lookup: ContentTypeLookup;
}

/**
 * Builds the registry from a list of plugin sources.
 *
 * The one place a plugin list becomes a registry. `validateContentTypes` is the
 * same check the API side runs, which is what catches a content type registered
 * on only one of the two sides - and what turns two plugins claiming
 * `blog/articles` into a `ContentEngineError` naming both, rather than a screen
 * that silently belongs to whichever loaded first.
 *
 * Order in does not affect order out: the entries are sorted by content type id,
 * so the same configuration produces the same registry whichever order the
 * plugins arrive in.
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

  return {
    all: () => all,
    byAdminPath: adminPath => byAdminPath.get(adminPath),
    byId: contentTypeId => byId.get(contentTypeId),
    lookup: adminPath => byAdminPath.get(adminPath)?.definition,
  };
};

/**
 * The message a caller gets when the application forgot to register.
 *
 * A named constant so a host's own test can assert on it without matching
 * English, and so the sentence says what to do rather than what went wrong. The
 * same shape as `ADMIN_TRANSPORT_MISSING`, for the same reason.
 */
export const CONTENT_FRONTEND_REGISTRY_MISSING =
  "No Content Engine registry is registered. Call setContentFrontendRegistry() from a module the application loads before any /admin/content route runs - src/lib/content-registry.ts, built from src/content-registry.gen.ts.";

let registered: ContentFrontendRegistry | undefined;

/**
 * Register the application's content registry, once, at module scope.
 *
 * For a host with no server-side plugin registry to read - a TanStack Start
 * application, where `vitnode.config.ts` is deliberately server-only. The
 * Next.js AdminCP never calls this: `./config.ts` derives the registry from the
 * config it can already see.
 *
 * Registering twice replaces the previous value rather than throwing, because a
 * hot reload re-evaluates the module and a build error is a worse answer than
 * the newer registry.
 *
 * Module scope means *per bundle* - the browser has one instance and the server
 * has one, and each registers its own. Nothing per-request or per-administrator
 * is stored here: a registry is a function of the installed plugins, which is
 * the same for every visitor, which is what makes a module-level value safe on a
 * server rendering many of them at once.
 */
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

import type { RouteMcpAnnotations } from "../../lib/mcp/route-options";
import type { Route } from "../../lib/route";
import type { AnyContentTypeDefinition } from "../types";

import { setRouteMcp } from "../../lib/route-metadata";

const READ: RouteMcpAnnotations = { openWorldHint: false, readOnlyHint: true };
const CREATE: RouteMcpAnnotations = {
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
  readOnlyHint: false,
};
const OVERWRITE: RouteMcpAnnotations = {
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
  readOnlyHint: false,
};
const SET_STATE_ADDITIVE: RouteMcpAnnotations = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  readOnlyHint: false,
};
const SET_STATE_REMOVING: RouteMcpAnnotations = {
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
  readOnlyHint: false,
};

interface ContentMcpOperationRoute {
  annotations: RouteMcpAnnotations;
  /** What the call must know beyond the route's own description. */
  guidance?: (definition: AnyContentTypeDefinition) => string | undefined;
  method: string;
  path: string;
}

const versionGuidance = (definition: AnyContentTypeDefinition) =>
  definition.editorial.enabled
    ? "Send `expectedVersion` - the record's current `version` from the detail tool - to change shared fields; a moved version answers 409."
    : undefined;

const localizedGuidance = (definition: AnyContentTypeDefinition) =>
  `Shared fields go in \`values\`, each language's fields in \`translations[]\` (\`locale\` + \`values\`); the default language "${definition.localization.defaultLocale}" must be among them when creating.`;

/**
 * The generated admin routes a plugin can expose as MCP tools, by the
 * Content Engine operation they perform. Uploads, preview links, live
 * editing and access rules are not offered: they are binary, browser-bound or
 * AdminCP-only. An operation the content type does not have (`publish`
 * without publication, `listTranslations` without localization) is refused
 * when the module is built.
 */
export const CONTENT_MCP_OPERATIONS = {
  list: { annotations: READ, method: "get", path: "/" },
  detail: { annotations: READ, method: "get", path: "/{id}" },
  create: { annotations: CREATE, method: "post", path: "/" },
  update: {
    annotations: OVERWRITE,
    guidance: versionGuidance,
    method: "put",
    path: "/{id}",
  },
  delete: { annotations: OVERWRITE, method: "delete", path: "/{id}" },
  duplicate: { annotations: CREATE, method: "post", path: "/{id}/duplicate" },
  publish: {
    annotations: SET_STATE_ADDITIVE,
    method: "post",
    path: "/{id}/publish",
  },
  unpublish: {
    annotations: SET_STATE_REMOVING,
    method: "post",
    path: "/{id}/unpublish",
  },
  hide: { annotations: SET_STATE_REMOVING, method: "post", path: "/{id}/hide" },
  unhide: {
    annotations: SET_STATE_ADDITIVE,
    method: "post",
    path: "/{id}/unhide",
  },
  listRevisions: { annotations: READ, method: "get", path: "/{id}/revisions" },
  showRevision: {
    annotations: READ,
    method: "get",
    path: "/{id}/revisions/{revisionId}",
  },
  restoreRevision: {
    annotations: OVERWRITE,
    method: "post",
    path: "/{id}/revisions/{revisionId}/restore",
  },
  listSchedules: { annotations: READ, method: "get", path: "/{id}/schedules" },
  schedule: { annotations: CREATE, method: "post", path: "/{id}/schedule" },
  cancelSchedule: {
    annotations: SET_STATE_REMOVING,
    method: "post",
    path: "/{id}/schedule/{scheduleId}/cancel",
  },
  createLocalized: {
    annotations: CREATE,
    guidance: localizedGuidance,
    method: "post",
    path: "/localized",
  },
  updateLocalized: {
    annotations: OVERWRITE,
    guidance: definition =>
      [
        "Shared fields go in `values` (omit it to leave them as they are), languages in `translations[]`; a language that already exists needs its `expectedVersion`.",
        versionGuidance(definition),
      ]
        .filter(Boolean)
        .join(" "),
    method: "put",
    path: "/{id}/localized",
  },
  listTranslations: {
    annotations: READ,
    method: "get",
    path: "/{id}/translations",
  },
  showTranslation: {
    annotations: READ,
    method: "get",
    path: "/{id}/translations/{locale}",
  },
  createTranslation: {
    annotations: CREATE,
    method: "post",
    path: "/{id}/translations/{locale}",
  },
  updateTranslation: {
    annotations: OVERWRITE,
    method: "put",
    path: "/{id}/translations/{locale}",
  },
  deleteTranslation: {
    annotations: OVERWRITE,
    method: "delete",
    path: "/{id}/translations/{locale}",
  },
  publishTranslation: {
    annotations: SET_STATE_ADDITIVE,
    method: "post",
    path: "/{id}/translations/{locale}/publish",
  },
  unpublishTranslation: {
    annotations: SET_STATE_REMOVING,
    method: "post",
    path: "/{id}/translations/{locale}/unpublish",
  },
} as const satisfies Record<string, ContentMcpOperationRoute>;

/** One Content Engine operation a generated admin route performs. */
export type ContentMcpOperation = keyof typeof CONTENT_MCP_OPERATIONS;

/**
 * Which generated admin routes become MCP tools, per content type id. Every
 * content type and operation is off unless listed; each operation is its own
 * choice - exposing `update` never exposes `publish` or `delete`.
 *
 * @example
 * ```ts
 * buildContentAdminModule({
 *   contentTypes: [categoryContent, postContent],
 *   mcp: {
 *     "blog.category": ["list", "detail"],
 *     "blog.post": ["list", "detail", "createLocalized", "updateLocalized"],
 *   },
 * });
 * ```
 */
export type ContentMcpExposure<Id extends string = string> = Partial<
  Record<Id, readonly ContentMcpOperation[]>
>;

const snakeCase = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .toLowerCase();

/**
 * Marks the routes `operations` selects among one content type's generated
 * admin routes. A tool is named `{content type id}_{operation}` in snake case
 * (`blog_post_create_localized`) and described by its route plus what a call
 * must know.
 *
 * @throws When an operation names a route this content type does not have.
 */
export const exposeContentRoutesOnMcp = (
  definition: AnyContentTypeDefinition,
  routes: readonly Route[],
  operations: readonly ContentMcpOperation[],
): void => {
  for (const operation of new Set(operations)) {
    const spec: ContentMcpOperationRoute | undefined =
      CONTENT_MCP_OPERATIONS[operation];
    if (!spec) {
      throw new Error(
        `[Content Engine] ${definition.id}: "${operation}" is not an MCP operation. Use one of ${Object.keys(CONTENT_MCP_OPERATIONS).join(", ")}.`,
      );
    }
    const route = routes.find(
      entry =>
        entry.route.method === spec.method && entry.route.path === spec.path,
    );
    if (!route) {
      throw new Error(
        `[Content Engine] ${definition.id}: cannot expose "${operation}" on MCP - this content type has no ${spec.method.toUpperCase()} ${spec.path} route. Turn on the option it needs (publication, visibility, editorial, localization, duplication, scheduling) or drop it from \`mcp\`.`,
      );
    }

    const routeDescription = (route.route as { description?: string })
      .description;
    const guidance = spec.guidance?.(definition);
    setRouteMcp(route, {
      annotations: spec.annotations,
      description: [
        `${routeDescription ?? operation} (content type "${definition.id}").`,
        guidance,
      ]
        .filter(Boolean)
        .join(" "),
      name: `${snakeCase(definition.id)}_${snakeCase(operation)}`,
    });
  }
};

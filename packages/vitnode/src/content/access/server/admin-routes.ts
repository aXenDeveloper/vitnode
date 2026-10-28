import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import type { RouteValidationHook } from "../../../api/lib/route";
import type { ContentAccessOverrides } from "../policy";
import type { AnyContentModel } from "../../server/model";
import type {
  ContentAccessAdminRole,
  ContentAccessEffectiveResponse,
  ContentAccessScopeReport,
} from "../schemas";
import type { ContentAccessFamily } from "./families";

import { resolveRoleNames } from "../../../api/lib/resolve-role-names";
import { buildRoute } from "../../../api/lib/route";
import { core_roles } from "../../../database/roles";
import { CONTENT_PERMISSIONS } from "../../const";
import {
  CONTENT_ACCESS_ACTIONS,
  type CONTENT_ACCESS_ERROR_CODES,
  CONTENT_ACCESS_MAX_EFFECTIVE_SCOPES,
} from "../const";
import {
  sameContentAccessAudience,
  zodContentAccessOverrides,
} from "../policy";
import { contentAccessAttachmentSupport } from "./attachments";
import { findContentAccessFamily, loadContentAccessFamilyState } from "./families";
import { expireContentAccessFamily, forgetContentAccessState } from "./invalidate";
import {
  zodContentAccessAdminResponse as zodAccessResponse,
  zodContentAccessEffectiveResponse,
  zodContentAccessError,
} from "../schemas";
import { contentAccessRequirementsForScopes } from "./decide";
import { contentAccessSourceOf } from "./source";
import { contentAccessScopeReport } from "./report";
import { ContentAccessRoleError, replaceContentAccessRules } from "./rules";

/** The roles a report names, with their translated names. Missing ones are left out. */
const rolesOf = async (
  c: Context,
  report: {
    actions: ContentAccessEffectiveResponse["actions"];
    overrides?: ContentAccessScopeReport["overrides"];
  },
): Promise<ContentAccessAdminRole[]> => {
  const ids = [
    ...new Set(
      CONTENT_ACCESS_ACTIONS.flatMap(action =>
        report.actions[action].requirements.flatMap(requirement =>
          requirement.audience.mode === "roles"
            ? requirement.audience.roleIds
            : [],
        ),
      ).concat(
        Object.values(report.overrides ?? {}).flatMap(audience =>
          audience.mode === "roles" ? audience.roleIds : [],
        ),
      ),
    ),
  ];
  if (ids.length === 0) return [];

  const [rows, names] = await Promise.all([
    c
      .get("db")
      .select({ color: core_roles.color, id: core_roles.id })
      .from(core_roles)
      .where(inArray(core_roles.id, ids)),
    resolveRoleNames(c, ids),
  ]);

  return rows.map(row => ({ ...row, name: names.get(row.id) ?? [] }));
};

const refuse = (
  status: 400 | 404 | 409,
  code: (typeof CONTENT_ACCESS_ERROR_CODES)[number],
  message: string,
): never => {
  throw new HTTPException(status, {
    res: Response.json({ code, message }, { status }),
  });
};

const validationHook: RouteValidationHook = (result, c) => {
  if (result.success) return undefined;

  return c.json(
    {
      code: "invalidAccess",
      message: result.error.issues
        .map(issue => `${issue.path.join(".")}: ${issue.message}`)
        .join("; "),
    },
    400,
  );
};

const errorResponse = (description: string) => ({
  content: { "application/json": { schema: zodContentAccessError } },
  description,
});

const idParams = z.object({
  id: z.string().regex(/^[A-Za-z0-9-]{1,64}$/),
});

const familyOf = (c: Context, familyId: string): ContentAccessFamily =>
  findContentAccessFamily(c, familyId) ??
  refuse(404, "notFound", "This collection has no access rules.");

const reportOf = async (
  c: Context,
  family: ContentAccessFamily,
  scopeId: string,
  preview?: ContentAccessOverrides,
) => {
  const report =
    (await contentAccessScopeReport(c, family, scopeId, preview)) ??
    refuse(404, "notFound", "The scope does not exist.");

  return {
    attachments: contentAccessAttachmentSupport(c),
    report,
    roles: await rolesOf(c, report),
  };
};

/**
 * The AdminCP access routes of one scope family, mounted under the family's
 * admin module (`/{id}/access`). Read needs `can_view`, writes `can_edit` of
 * the module. Plugins do not call this directly.
 */
export const buildContentAccessAdminRoutes = <P extends string>({
  familyId,
  permissionModule,
  pluginId,
}: {
  familyId: string;
  permissionModule: string;
  pluginId: P;
}) => {
  const module = permissionModule;

  const read = buildRoute({
    pluginId,
    hook: validationHook,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.view },
    route: {
      method: "get",
      path: "/{id}/access",
      description: `Read one scope's access rules in ${familyId}: its own rules, what it inherits and every requirement its ancestors add (Admin only)`,
      request: { params: idParams },
      responses: {
        200: {
          content: { "application/json": { schema: zodAccessResponse } },
          description: "The scope's access report",
        },
        403: { description: "Access Denied" },
        404: errorResponse("No such scope"),
      },
    },
    handler: async c => {
      const { id } = c.req.valid("param");

      return c.json(await reportOf(c, familyOf(c, familyId), id), 200, {
        "Cache-Control": "private, no-store",
      });
    },
  });

  const preview = buildRoute({
    pluginId,
    hook: validationHook,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.view },
    route: {
      method: "post",
      path: "/{id}/access/preview",
      description: `Preview what one scope's access would be with other rules, without saving them, in ${familyId} (Admin only)`,
      request: {
        params: idParams,
        body: {
          required: true,
          content: {
            "application/json": {
              schema: z.object({ overrides: zodContentAccessOverrides }),
            },
          },
        },
      },
      responses: {
        200: {
          content: { "application/json": { schema: zodAccessResponse } },
          description: "The scope's access report with the previewed rules",
        },
        400: errorResponse("An invalid rule"),
        403: { description: "Access Denied" },
        404: errorResponse("No such scope"),
      },
    },
    handler: async c => {
      const { id } = c.req.valid("param");
      const { overrides } = c.req.valid("json");

      return c.json(
        await reportOf(c, familyOf(c, familyId), id, overrides),
        200,
        { "Cache-Control": "private, no-store" },
      );
    },
  });

  const update = buildRoute({
    pluginId,
    hook: validationHook,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.edit },
    route: {
      method: "put",
      path: "/{id}/access",
      description: `Replace one scope's access rules in ${familyId}. An action left out inherits from the parent and the definition (Admin only)`,
      request: {
        params: idParams,
        body: {
          required: true,
          content: {
            "application/json": {
              schema: z.object({ overrides: zodContentAccessOverrides }),
            },
          },
        },
      },
      responses: {
        200: {
          content: { "application/json": { schema: zodAccessResponse } },
          description: "Rules saved",
        },
        400: errorResponse(
          "An invalid rule, an unknown role, or protected downloads without private storage",
        ),
        403: { description: "Access Denied" },
        404: errorResponse("No such scope"),
      },
    },
    handler: async c => {
      const { id } = c.req.valid("param");
      const { overrides } = c.req.valid("json");
      const family = familyOf(c, familyId);
      const state = await loadContentAccessFamilyState(c, family);
      if (!state.parents.has(id)) {
        return refuse(404, "notFound", "The scope does not exist.");
      }

      // A download rule that keeps anybody out is a promise about bytes, which
      // only private storage can keep: refuse it rather than claim it.
      const download = overrides.downloadAttachments;
      if (
        download &&
        download.mode !== "everyone" &&
        !contentAccessAttachmentSupport(c).privateStorage
      ) {
        return refuse(
          400,
          "unsupportedStorage",
          "The storage adapter cannot keep files private, so attachment downloads cannot be restricted.",
        );
      }

      const before = state.rules.get(id) ?? {};
      try {
        await replaceContentAccessRules(c.get("db"), {
          family: family.id,
          overrides,
          scopeId: id,
        });
      } catch (error) {
        if (error instanceof ContentAccessRoleError) {
          return refuse(
            400,
            "unknownRole",
            `Role ${error.roleIds.join(", ")} does not exist or cannot be chosen.`,
          );
        }
        throw error;
      }

      const changedActions = CONTENT_ACCESS_ACTIONS.filter(action => {
        const old = before[action];
        const next = overrides[action];
        if (!old || !next) return old !== next;

        return !sameContentAccessAudience(old, next);
      });

      forgetContentAccessState(c);
      if (changedActions.length > 0) {
        await expireContentAccessFamily(c, family);
        await c.get("events").emit("content.access.updated", {
          changedActions,
          family: family.id,
          pluginId: family.pluginId,
          scopeId: id,
          userId: c.get("admin")?.user.id ?? c.get("user")?.id ?? null,
        });
      }

      return c.json(await reportOf(c, family, id), 200, {
        "Cache-Control": "private, no-store",
      });
    },
  });

  return [read, preview, update];
};

/**
 * `POST /access/effective` on the admin module of a content type filed under
 * scopes (`access.from`): what a record in the given scopes would require,
 * every scope together - the article editor shows it before saving. Needs
 * `can_view` of the content type. Plugins do not call this directly.
 */
export const buildContentAccessEffectiveRoute = <P extends string>({
  contentTypeId,
  permissionModule,
  pluginId,
}: {
  contentTypeId: string;
  permissionModule: string;
  pluginId: P;
}) =>
  buildRoute({
    pluginId,
    hook: validationHook,
    adminStaffPermission: {
      module: permissionModule,
      permission: CONTENT_PERMISSIONS.view,
    },
    route: {
      method: "post",
      path: "/access/effective",
      description: `What a ${contentTypeId} record filed in these scopes would require of a reader, every scope together (Admin only)`,
      request: {
        body: {
          required: true,
          content: {
            "application/json": {
              schema: z.object({
                scopeIds: z
                  .array(z.union([z.string().max(64), z.number().int()]))
                  .max(CONTENT_ACCESS_MAX_EFFECTIVE_SCOPES),
              }),
            },
          },
        },
      },
      responses: {
        200: {
          content: {
            "application/json": { schema: zodContentAccessEffectiveResponse },
          },
          description: "Requirements per action",
        },
        403: { description: "Access Denied" },
        404: errorResponse("The content type is not filed under scopes"),
      },
    },
    handler: async c => {
      const model = (
        (c.get("core")?.contentModels ?? []) as {
          model: AnyContentModel;
        }[]
      ).find(entry => entry.model.definition.id === contentTypeId)?.model;
      const source = model ? contentAccessSourceOf(c, model) : null;
      if (source?.kind !== "scopes") {
        return refuse(404, "notFound", "This content type has no scopes.");
      }

      const ids = [
        ...new Set(c.req.valid("json").scopeIds.map(id => String(id))),
      ];
      const state = await loadContentAccessFamilyState(c, source.family);
      const scopes = ids.map(scopeId => ({
        family: source.family.id,
        scopeId,
      }));
      const actions = Object.fromEntries(
        await Promise.all(
          CONTENT_ACCESS_ACTIONS.map(
            async action =>
              [
                action,
                {
                  requirements: await contentAccessRequirementsForScopes(
                    c,
                    scopes,
                    action,
                  ),
                },
              ] as const,
          ),
        ),
      ) as ContentAccessEffectiveResponse["actions"];

      return c.json(
        {
          actions,
          missing: ids.filter(id => !state.parents.has(id)),
          roles: await rolesOf(c, { actions }),
        },
        200,
        { "Cache-Control": "private, no-store" },
      );
    },
  });

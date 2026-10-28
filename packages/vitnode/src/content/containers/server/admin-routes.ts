import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import type { RouteValidationHook } from "../../../api/lib/route";
import type {
  AnyContentContainerDefinition,
  ContentContainerCreateInput,
  ContentContainerMoveInput,
  ContentContainerRecord,
  ContentContainerUpdateInput,
} from "../types";
import type { ContentContainerUsageCheck } from "./service";

import { buildRoute } from "../../../api/lib/route";
import { buildContentAccessAdminRoutes } from "../../access/server/admin-routes";
import { CONTENT_PERMISSIONS } from "../../const";
import { CONTENT_CONTAINER_ERROR_CODES } from "../const";
import { ContentContainerError } from "../errors";
import {
  zodContentContainerPolicyOverrides,
  zodEffectiveContentContainerPolicy,
} from "../policies";
import {
  contentContainerInputRefusal,
  createContentContainerService,
} from "./service";

/** The error body the container admin routes answer with. */
export const zodContentContainerError = z.object({
  code: z.enum(CONTENT_CONTAINER_ERROR_CODES),
  message: z.string(),
});

const containerError = (error: unknown): never => {
  if (error instanceof ContentContainerError) {
    throw new HTTPException(error.status, {
      res: Response.json(
        { code: error.code, message: error.detail },
        { status: error.status },
      ),
    });
  }

  throw error;
};

const validationHook: RouteValidationHook = (result, c) => {
  if (result.success) return undefined;

  return c.json(contentContainerInputRefusal(result.error), 400);
};

const zodPolicySource = z.union([
  z.object({ containerId: z.number(), kind: z.literal("container") }),
  z.object({ kind: z.enum(["contentType", "default", "fallback"]) }),
]);

export const zodContentContainerPolicyReport = z.object({
  contentTypes: z.array(
    z.object({
      contentTypeId: z.string(),
      effective: zodEffectiveContentContainerPolicy,
      inherited: zodEffectiveContentContainerPolicy,
      pluginId: z.string(),
      sources: z.record(z.string(), zodPolicySource),
    }),
  ),
  id: z.number(),
  overrides: zodContentContainerPolicyOverrides,
});

const idParams = z.object({
  id: z.coerce.number().int().positive(),
});

const errorResponse = (description: string) => ({
  content: { "application/json": { schema: zodContentContainerError } },
  description,
});

/**
 * The AdminCP routes of one content container type, mounted by
 * `buildContentAdminModule`; plugins do not call this directly.
 */
export const buildContentContainerAdminRoutes = <
  TDefinition extends AnyContentContainerDefinition,
  P extends string,
>(
  definition: TDefinition,
  { pluginId, usage }: { pluginId: P; usage?: ContentContainerUsageCheck },
) => {
  const module = definition.admin.permissionModule;
  const schemas = definition.schemas as unknown as {
    create: z.ZodType<ContentContainerCreateInput<TDefinition>>;
    move: z.ZodType<ContentContainerMoveInput>;
    record: z.ZodType<ContentContainerRecord<TDefinition>>;
    update: z.ZodType<ContentContainerUpdateInput<TDefinition>>;
  };
  const service = (c: Context) =>
    createContentContainerService(c, { definition, pluginId, usage });

  const list = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.view },
    route: {
      method: "get",
      path: "/",
      description: `List every container of ${definition.id}, in tree order (Admin only)`,
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.object({ items: z.array(schemas.record) }),
            },
          },
          description: "Every container, each parent followed by its subtree",
        },
        403: { description: "Access Denied" },
      },
    },
    handler: async c => c.json({ items: await service(c).list() }, 200),
  });

  const create = buildRoute({
    pluginId,
    hook: validationHook,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.create },
    route: {
      method: "post",
      path: "/",
      description: `Create a container in ${definition.id} (Admin only)`,
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: schemas.create } },
        },
      },
      responses: {
        201: {
          content: { "application/json": { schema: schemas.record } },
          description: "Container created",
        },
        400: errorResponse("The tree rules or the definition refuse it"),
        403: { description: "Access Denied" },
        409: errorResponse("The slug is taken, or the collection is full"),
      },
    },
    handler: async c => {
      try {
        return c.json(await service(c).create(c.req.valid("json")), 201);
      } catch (error) {
        return containerError(error);
      }
    },
  });

  const update = buildRoute({
    pluginId,
    hook: validationHook,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.edit },
    route: {
      method: "patch",
      path: "/{id}",
      description: `Update a container's name, slug or values in ${definition.id} (Admin only)`,
      request: {
        params: idParams,
        body: {
          required: true,
          content: { "application/json": { schema: schemas.update } },
        },
      },
      responses: {
        200: {
          content: { "application/json": { schema: schemas.record } },
          description: "Container updated",
        },
        400: errorResponse("The values do not match the definition"),
        403: { description: "Access Denied" },
        404: errorResponse("No such container in this collection"),
        409: errorResponse("The slug is taken"),
      },
    },
    handler: async c => {
      try {
        const { id } = c.req.valid("param");

        return c.json(await service(c).update(id, c.req.valid("json")), 200);
      } catch (error) {
        return containerError(error);
      }
    },
  });

  const move = buildRoute({
    pluginId,
    hook: validationHook,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.edit },
    route: {
      method: "post",
      path: "/{id}/move",
      description: `Move a container to another parent, another position among its siblings, or both, in ${definition.id} (Admin only)`,
      request: {
        params: idParams,
        body: {
          required: true,
          content: { "application/json": { schema: schemas.move } },
        },
      },
      responses: {
        200: {
          content: { "application/json": { schema: schemas.record } },
          description: "Container moved",
        },
        400: errorResponse(
          "A cycle, a missing parent, a position out of range or too deep",
        ),
        403: { description: "Access Denied" },
        404: errorResponse("No such container in this collection"),
      },
    },
    handler: async c => {
      try {
        const { id } = c.req.valid("param");

        return c.json(await service(c).move(id, c.req.valid("json")), 200);
      } catch (error) {
        return containerError(error);
      }
    },
  });

  const remove = buildRoute({
    pluginId,
    hook: validationHook,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.delete },
    route: {
      method: "delete",
      path: "/{id}",
      description: `Delete an empty container from ${definition.id} (Admin only)`,
      request: { params: idParams },
      responses: {
        204: { description: "Container deleted" },
        403: { description: "Access Denied" },
        404: errorResponse("No such container in this collection"),
        409: errorResponse("The container still has children or content"),
      },
    },
    handler: async c => {
      try {
        await service(c).delete(c.req.valid("param").id);

        return c.body(null, 204);
      } catch (error) {
        return containerError(error);
      }
    },
  });

  const access = definition.access.enabled
    ? buildContentAccessAdminRoutes({
        familyId: definition.id,
        permissionModule: module,
        pluginId,
      })
    : [];

  if (!definition.policies.enabled) {
    return [list, create, update, move, remove, ...access];
  }

  const policies = buildRoute({
    pluginId,
    hook: validationHook,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.view },
    route: {
      method: "get",
      path: "/{id}/policies",
      description: `Read a container's publishing policies in ${definition.id}: its own overrides and what applies to each content type (Admin only)`,
      request: { params: idParams },
      responses: {
        200: {
          content: {
            "application/json": { schema: zodContentContainerPolicyReport },
          },
          description: "Overrides and effective policies",
        },
        403: { description: "Access Denied" },
        404: errorResponse("No such container in this collection"),
      },
    },
    handler: async c => {
      try {
        const { id } = c.req.valid("param");

        return c.json(await service(c).policies(id), 200);
      } catch (error) {
        return containerError(error);
      }
    },
  });

  const updatePolicies = buildRoute({
    pluginId,
    hook: validationHook,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.edit },
    route: {
      method: "put",
      path: "/{id}/policies",
      description: `Replace a container's publishing policy overrides in ${definition.id}. A key left out inherits from the parent container and the definition (Admin only)`,
      request: {
        params: idParams,
        body: {
          required: true,
          content: {
            "application/json": {
              schema: z.object({
                overrides: zodContentContainerPolicyOverrides,
              }),
            },
          },
        },
      },
      responses: {
        200: {
          content: {
            "application/json": { schema: zodContentContainerPolicyReport },
          },
          description: "Overrides saved",
        },
        400: errorResponse("An unknown content type or an invalid value"),
        403: { description: "Access Denied" },
        404: errorResponse("No such container in this collection"),
      },
    },
    handler: async c => {
      try {
        const { id } = c.req.valid("param");
        const { overrides } = c.req.valid("json");

        return c.json(await service(c).updatePolicies(id, overrides), 200);
      } catch (error) {
        return containerError(error);
      }
    },
  });

  return [
    list,
    create,
    update,
    move,
    remove,
    policies,
    updatePolicies,
    ...access,
  ];
};

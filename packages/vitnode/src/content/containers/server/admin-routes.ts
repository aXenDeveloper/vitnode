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
import { CONTENT_PERMISSIONS } from "../../const";
import { CONTENT_CONTAINER_ERROR_CODES } from "../const";
import { ContentContainerError } from "../errors";
import { createContentContainerService } from "./service";

/** The body every refused container write answers with. */
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

/**
 * A body the route schema refuses answers in the same `{ code, message }` shape
 * the service's own refusals use, so the AdminCP translates one contract.
 */
const validationHook: RouteValidationHook = (result, c) => {
  if (result.success) return undefined;

  const { issues } = result.error;

  return c.json(
    {
      code: issues.some(issue => issue.path[0] === "metadata")
        ? "invalidMetadata"
        : "invalidInput",
      message: issues
        .map(issue =>
          issue.path.length > 0
            ? `${issue.path.join(".")}: ${issue.message}`
            : issue.message,
        )
        .join("; "),
    },
    400,
  );
};

const idParams = z.object({
  id: z.coerce.number().int().positive(),
});

const errorResponse = (description: string) => ({
  content: { "application/json": { schema: zodContentContainerError } },
  description,
});

/**
 * The AdminCP routes of one container collection, mounted under
 * `/api/{pluginId}/admin/content/{admin.permissionModule}`. Every one of them is
 * gated by the collection's own staff permission module.
 */
export const buildContentContainerAdminRoutes = <
  TDefinition extends AnyContentContainerDefinition,
  P extends string,
>(
  definition: TDefinition,
  { pluginId, usage }: { pluginId: P; usage?: ContentContainerUsageCheck },
) => {
  const module = definition.admin.permissionModule;
  // Typed views of the definition's schemas, so the fetcher infers each
  // container's own metadata rather than an anonymous record.
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

  return [list, create, update, move, remove];
};

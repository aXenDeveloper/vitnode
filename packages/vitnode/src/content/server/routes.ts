import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import type { AnyContentTypeDefinition } from "../types";
import type { ContentModel } from "./model";

import { buildRoute } from "../../api/lib/route";
import {
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "../../api/lib/with-pagination";
import { CONTENT_OPTIONS_LIMIT, CONTENT_PERMISSIONS } from "../const";
import { orderableColumns } from "../registry";
import { emitContentEvent } from "./emit";
import { withHttpErrors } from "./http-errors";

const zodLabels = z.record(z.string(), z.string().nullable());

const zodOptions = z.object({
  items: z.array(z.object({ label: z.string(), value: z.number() })),
});

const notFound = (definition: AnyContentTypeDefinition): HTTPException =>
  new HTTPException(404, {
    message: `${definition.admin.label.singular} not found.`,
  });

const identifier = (c: Context): number => {
  const value = Number(c.req.param("id"));
  if (!Number.isInteger(value) || value <= 0) {
    throw new HTTPException(400, { message: "Invalid identifier." });
  }

  return value;
};

/**
 * The five CRUD routes plus the picker-options route for one content type.
 *
 * Every route carries an explicit `adminStaffPermission`, and every path sits
 * under `/admin/` so the global admin session middleware runs - both are
 * required for `assertStaffPermission` to have an admin to check.
 */
export const buildContentRoutes = <
  TDefinition extends AnyContentTypeDefinition,
  P extends string,
>(
  model: ContentModel<TDefinition>,
  { pluginId }: { pluginId: P },
) => {
  const { definition, schemas } = model;
  const module = definition.permissionModule;
  const label = definition.admin.label;

  const listRow = schemas.selectObject.extend({ labels: zodLabels });

  // `c.req.valid()` cannot infer through a generic route config, so each
  // handler re-reads the validated payload through the very schema that
  // produced it. That keeps the handlers cast-free and correctly typed.
  const readJson = async <TValue>(
    c: Context,
    schema: z.ZodType<TValue>,
  ): Promise<TValue> => schema.parse(await c.req.json());

  // `orderBy` is an enum rather than a string so an unknown column is a 400 at
  // validation time and shows up in the OpenAPI document. The service keeps its
  // own allowlist check as defence in depth.
  const orderable = orderableColumns(definition) as [string, ...string[]];
  const paginationQuery = zodPaginationQuery.extend({
    order: z.enum(["asc", "desc"]).optional(),
    orderBy: z.enum(orderable).optional(),
    search: z.string().optional(),
  });
  const jsonBody = (schema: z.ZodType) => ({
    content: { "application/json": { schema } },
  });
  const jsonResponse = (schema: z.ZodType, description: string) => ({
    content: { "application/json": { schema } },
    description,
  });

  const list = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.view },
    route: {
      method: "get",
      path: "/",
      description: `List ${label.plural}`,
      request: { query: paginationQuery.extend(schemas.filters.shape) },
      responses: {
        200: jsonResponse(
          z.object({
            edges: z.array(listRow),
            pageInfo: zodPaginationPageInfo,
          }),
          `${label.plural} retrieved successfully`,
        ),
      },
    },
    handler: async c => {
      const raw = c.req.query();
      const { cursor, first, last, order, orderBy, search } =
        paginationQuery.parse(raw);
      // Parsing through `schemas.filters` strips the pagination keys and
      // coerces each declared filter; anything else never reaches the service.
      const filters = schemas.filters.parse(raw);

      const data = await model.service(c).findMany({
        filters,
        orderBy: { column: orderBy, order },
        query: { cursor, first, last, search },
      });

      return c.json(data, 200);
    },
  });

  const options = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.view },
    route: {
      method: "get",
      path: "/options/{field}",
      description: `Picker options for a ${label.singular} relation`,
      request: {
        params: z.object({ field: z.string() }),
        query: z.object({ search: z.string().optional() }),
      },
      responses: {
        200: jsonResponse(zodOptions, `Up to ${CONTENT_OPTIONS_LIMIT} options`),
      },
    },
    handler: async c => {
      const field = c.req.param("field");
      const search = c.req.query("search");

      const items = await model.service(c).options(field, search);

      return c.json({ items }, 200);
    },
  });

  const detail = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.view },
    route: {
      method: "get",
      path: "/{id}",
      description: `Get one ${label.singular}`,
      request: { params: schemas.params },
      responses: {
        200: jsonResponse(schemas.selectObject, `${label.singular} found`),
        404: { description: `${label.singular} not found` },
      },
    },
    handler: async c => {
      const row = await model.service(c).findById(identifier(c));
      if (!row) throw notFound(definition);

      return c.json(row, 200);
    },
  });

  const create = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.create },
    route: {
      method: "post",
      path: "/",
      description: `Create a ${label.singular}`,
      request: { body: jsonBody(schemas.create) },
      responses: {
        201: jsonResponse(
          schemas.selectObject,
          `${label.singular} created successfully`,
        ),
        400: { description: "Invalid input data" },
      },
    },
    handler: async c => {
      const values = await readJson(c, schemas.create);

      const row = await withHttpErrors("create", async () =>
        model.service(c).create(values),
      );

      // Emitted only once the write has returned, never inside a transaction.
      await emitContentEvent(c, definition, "created", { contentId: row.id });

      return c.json(row, 201);
    },
  });

  const update = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.edit },
    route: {
      // PUT, not PATCH: the Next.js API route handler exports no PATCH.
      method: "put",
      path: "/{id}",
      description: `Update a ${label.singular}`,
      request: { params: schemas.params, body: jsonBody(schemas.update) },
      responses: {
        200: jsonResponse(
          schemas.selectObject,
          `${label.singular} updated successfully`,
        ),
        400: { description: "Invalid or empty payload" },
        404: { description: `${label.singular} not found` },
      },
    },
    handler: async c => {
      const values = await readJson(c, schemas.update);

      const result = await withHttpErrors("update", async () =>
        model.service(c).update(identifier(c), values),
      );
      if (!result) throw notFound(definition);

      if (result.changedFields.length > 0) {
        await emitContentEvent(c, definition, "updated", {
          changedFields: result.changedFields,
          contentId: result.row.id,
        });
      }

      return c.json(result.row, 200);
    },
  });

  const remove = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.delete },
    route: {
      method: "delete",
      path: "/{id}",
      description: `Delete a ${label.singular}`,
      request: { params: schemas.params },
      responses: {
        200: jsonResponse(
          schemas.selectObject,
          `${label.singular} deleted successfully`,
        ),
        404: { description: `${label.singular} not found` },
        409: { description: "Still referenced by other content" },
      },
    },
    handler: async c => {
      const row = await withHttpErrors("delete", async () =>
        model.service(c).delete(identifier(c)),
      );
      if (!row) throw notFound(definition);

      await emitContentEvent(c, definition, "deleted", { contentId: row.id });

      return c.json(row, 200);
    },
  });

  return [list, options, detail, create, update, remove];
};

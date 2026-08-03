import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import type {
  AnyContentTypeDefinition,
  ContentPublicFilterInput,
  ContentPublicOrderableFieldName,
} from "../types";
import type { ContentModel } from "./model";
import type { ContentPublicService } from "./public-service";

import { buildRoute } from "../../api/lib/route";
import {
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "../../api/lib/with-pagination";
import { CONTENT_PUBLIC_MAX_PAGE_SIZE } from "../const";
import { ContentEngineError } from "../errors";
import { publicOrderableColumns } from "../registry";

/**
 * The two read-only routes one public content type gets.
 *
 * ```http
 * GET /api/{pluginId}/content/{publicApi.path}/
 * GET /api/{pluginId}/content/{publicApi.path}/{slug}
 * ```
 *
 * No `adminStaffPermission` and no `/admin/` anywhere in the path, which is
 * exactly how every other public route in VitNode is public: by omission. The
 * global middleware still runs, so `c.get("user")` is populated (possibly
 * `null`) and the IP rate limiter still applies.
 *
 * Only `get` is ever built here. There is no public create, update, delete,
 * publish or unpublish, and no flag that would add one.
 */
export const buildContentPublicRoutes = <
  TDefinition extends AnyContentTypeDefinition,
  P extends string,
>(
  model: ContentModel<TDefinition>,
  { pluginId }: { pluginId: P },
) => {
  const { definition, schemas } = model;
  const label = definition.admin.label;

  const service = (c: Context): ContentPublicService<TDefinition> => {
    const build = model.publicService;
    if (!build) {
      throw new ContentEngineError(
        "This content type has no public API, so it should not have a public route either.",
        { contentTypeId: definition.id },
      );
    }

    return build(c);
  };

  // `orderBy` is a literal enum, so a column outside the public allowlist is a
  // 400 at validation time and shows up in the OpenAPI document. The service
  // keeps its own allowlist check for callers that did not come through here.
  const orderable = publicOrderableColumns(definition) as [string, ...string[]];
  const paginationQuery = zodPaginationQuery.extend({
    order: z.enum(["asc", "desc"]).optional(),
    orderBy: z.enum(orderable).optional(),
    search: z.string().optional(),
  });
  const listQuery = paginationQuery.extend(schemas.publicFilters.shape);

  const notFound = () =>
    new HTTPException(404, {
      message: `${label.singular} not found.`,
    });

  const list = buildRoute({
    pluginId,
    route: {
      method: "get",
      path: "/",
      description: `List published ${label.plural}`,
      request: { query: listQuery },
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.object({
                edges: z.array(schemas.publicSelectObject),
                pageInfo: zodPaginationPageInfo,
              }),
            },
          },
          description: `Up to ${CONTENT_PUBLIC_MAX_PAGE_SIZE} published ${label.plural}`,
        },
        400: { description: "Invalid query parameters" },
      },
    },
    handler: async c => {
      // The whole query string goes through both schemas, each reading only the
      // keys it owns, and neither is strict - so a stale bookmark or a tracking
      // parameter is ignored rather than turned into a 400. `orderBy` is the
      // exception: a *present* but unknown column fails validation.
      const raw = c.req.query();
      const { cursor, first, last, order, orderBy, search } =
        paginationQuery.parse(raw);
      const filters = schemas.publicFilters.parse(
        raw,
      ) as ContentPublicFilterInput<TDefinition>;

      const data = await service(c).findMany({
        filters,
        // Both narrowings restate what the schemas just proved: `orderBy` came
        // out of a literal enum built from `publicApi.orderableFields`, and
        // `filters` out of a shape built from `publicApi.filterableFields`. The
        // service re-checks both, since the type is not what protects the query.
        orderBy: {
          column: orderBy as ContentPublicOrderableFieldName<TDefinition>,
          order,
        },
        query: { cursor, first, last, search },
      });

      return c.json(data, 200);
    },
  });

  const detail = buildRoute({
    pluginId,
    route: {
      method: "get",
      path: "/{slug}",
      description: `Get one published ${label.singular} by slug`,
      request: { params: schemas.publicParams },
      responses: {
        200: {
          content: {
            "application/json": { schema: schemas.publicSelectObject },
          },
          description: `${label.singular} found`,
        },
        404: { description: `${label.singular} not found` },
      },
    },
    handler: async c => {
      // A draft, an unpublished row, a cleared publication date and a typo are
      // all the same 404. A 403 would confirm the record exists, which is the
      // one thing a draft URL must not do.
      const row = await service(c).findBySlug(c.req.param("slug"));
      if (!row) throw notFound();

      return c.json(row, 200);
    },
  });

  return [list, detail];
};

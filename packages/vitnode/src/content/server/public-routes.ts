import type { PgTableWithColumns, TableConfig } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import type {
  AnyContentTypeDefinition,
  ContentPublicFilterInput,
  ContentPublicOrderableFieldName,
} from "../types";
import type { ContentModel } from "./model";
import type { ContentPreviewTokenPayload } from "./preview-token";
import type { ContentPublicService } from "./public-service";

import { buildRoute } from "../../api/lib/route";
import {
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "../../api/lib/with-pagination";
import { CONFIG, isSecureContentPreviewSecret } from "../../lib/config";
import { CONTENT_PUBLIC_MAX_PAGE_SIZE } from "../const";
import { ContentEngineError } from "../errors";
import { publicOrderableColumns } from "../registry";
import { verifyContentPreviewToken } from "./preview-token";
import {
  contentPublicSelection,
  createContentPublicProjector,
} from "./public-service";
import { contentSnapshotRow } from "./revision-snapshot";

/**
 * The read-only routes one public content type gets.
 *
 * ```http
 * GET /api/{pluginId}/content/{publicApi.path}/
 * GET /api/{pluginId}/content/{publicApi.path}/{slug}
 * GET /api/{pluginId}/content/{publicApi.path}/preview/{token}   (editorial.preview)
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

  const project = createContentPublicProjector(definition);

  // Widened, not cast: the generated table type carries every column as a
  // literal, which Drizzle's `.from()` overloads cannot resolve through a
  // generic. This is the same parameter type `createContentPublicService`
  // declares, so the assignment is checked rather than asserted.
  const table: PgTableWithColumns<TableConfig> = model.table;

  /**
   * The row a preview link points at.
   *
   * Normally the revision's frozen snapshot, so a reviewer sees what the editor
   * was looking at when they shared the link rather than whatever the record
   * has drifted to since.
   *
   * `r === 0` is the one case that reads live: a record that predates its
   * content type opting into `editorial` has no revision to freeze. It is still
   * scoped to the id inside the signed token, and still projected through the
   * public allowlist - only the "frozen" guarantee is unavailable, because
   * there is nothing to freeze.
   */
  const readPreviewRow = async (
    c: Context,
    payload: ContentPreviewTokenPayload,
  ): Promise<null | Record<string, unknown>> => {
    if (payload.r > 0) {
      const build = model.editorialService;
      if (!build) return null;

      // Scoped by the record id from the token as well as the revision id: the
      // revisions table is shared, so an id alone proves nothing about
      // ownership - and the token's own id is the one this route trusts.
      const revision = await build(c, { pluginId }).revisions.findById(
        payload.i,
        payload.r,
      );

      return revision ? contentSnapshotRow(revision.snapshot) : null;
    }

    // Deliberately no published predicate - previewing a draft is the whole
    // feature - but still only the allowlisted columns, so a private one is
    // never fetched in the first place.
    const [row] = await c
      .get("db")
      .select(contentPublicSelection(definition, model.columns))
      .from(table)
      .where(eq(model.columns.id, payload.i))
      .limit(1);

    return row ?? null;
  };

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

  /**
   * The one public route that can return an unpublished record.
   *
   * Everything that makes that safe is in this handler, so it is worth reading
   * as a whole:
   *
   * - **The token is the authorization.** Signed with HMAC-SHA256, bound to one
   *   plugin, one content type, one record and one revision, and expiring. No
   *   session is consulted, which is the point - a reviewer has no account.
   * - **Every failure is the same 404.** A forged signature, an expired link, a
   *   token for another record and a record that never existed are
   *   indistinguishable. A 401 or a 403 would confirm the record exists, which
   *   is precisely what a draft URL must not do.
   * - **The projection is the public one.** `createContentPublicProjector` is
   *   the same function the detail route uses, so a private field cannot be
   *   public here and private there.
   * - **Nothing caches it.** `private, no-store` keeps it out of shared caches
   *   and `noindex, nofollow` keeps it out of search results, in case a link is
   *   pasted somewhere public.
   */
  const preview = buildRoute({
    pluginId,
    route: {
      method: "get",
      // Two segments, so it can never shadow `/{slug}` - a record whose slug is
      // literally "preview" still resolves the ordinary way.
      path: "/preview/{token}",
      description: `Read one ${label.singular} from a signed preview link`,
      request: { params: z.object({ token: z.string() }) },
      responses: {
        200: {
          content: {
            "application/json": { schema: schemas.publicSelectObject },
          },
          description: `${label.singular} as the link's revision recorded it`,
        },
        404: { description: "No such preview" },
      },
    },
    handler: async c => {
      const secret =
        c.get("core")?.contentPreviewSecret ?? CONFIG.contentPreviewSecret;

      // Fail closed, and fail *indistinguishably*. A deployment whose secret is
      // missing or still the published placeholder can have its tokens forged
      // by anyone, so no token is honoured at all - and the answer is the same
      // 404 a bad signature gets, because "preview is misconfigured here" is
      // not something an anonymous request needs to learn.
      if (!isSecureContentPreviewSecret(secret)) throw notFound();

      const payload = verifyContentPreviewToken({
        definition,
        pluginId,
        secret,
        token: c.req.param("token"),
      });
      if (!payload) throw notFound();

      const row = await readPreviewRow(c, payload);
      if (!row) throw notFound();

      return c.json(project(row), 200, {
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      });
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

  return [
    list,
    // Before `detail` for readability only - the two can never both match, so
    // the order carries no meaning.
    ...(definition.editorial.preview.enabled ? [preview] : []),
    detail,
  ];
};

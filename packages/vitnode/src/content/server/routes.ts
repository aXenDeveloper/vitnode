import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import type {
  AnyContentTypeDefinition,
  ContentFilterInput,
  ContentReferenceFieldName,
} from "../types";
import type { ContentModel } from "./model";

import { buildRoute } from "../../api/lib/route";
import {
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "../../api/lib/with-pagination";
import { CONFIG } from "../../lib/config";
import {
  zodContentConflict,
  zodContentScheduleRejection,
  zodContentUnprocessable,
} from "../conflicts";
import {
  CONTENT_ACTOR_TYPES,
  CONTENT_OPTIONS_LIMIT,
  CONTENT_PERMISSIONS,
  CONTENT_PREVIEW_TOKEN_PLACEHOLDER,
  CONTENT_REVISION_OPERATIONS,
  CONTENT_SCHEDULE_ACTIONS,
  CONTENT_SCHEDULE_STATUSES,
} from "../const";
import { orderableColumns } from "../registry";
import { resolveContentActor } from "./actor";
import { contentEditorialEffects } from "./editorial-effects";
import { emitContentEvent } from "./emit";
import { withHttpErrors } from "./http-errors";
import { createContentPreviewToken } from "./preview-token";
import { publicationMethods } from "./publication";
import { syncContentSearch } from "./search-sync";

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
  const publicationResponse = z.object({
    /** `false` when the record was already in the requested state. */
    changed: z.boolean(),
    row: schemas.selectObject,
  });

  const referenceFieldNames = Object.entries(definition.fields)
    .filter(
      ([, fieldValue]) =>
        fieldValue.kind === "relation" || fieldValue.kind === "user",
    )
    .map(([name]) => name);

  // A predicate rather than a cast: the picker route takes its field name from
  // the URL, so membership has to be proven at runtime anyway.
  const isReferenceField = (
    value: string,
  ): value is ContentReferenceFieldName<TDefinition> =>
    referenceFieldNames.includes(value);

  // `c.req.valid()` cannot infer through a generic route config, so each
  // handler re-reads the validated payload through the very schema that
  // produced it. That keeps the handlers cast-free and correctly typed.
  const readJson = async <TValue>(
    c: Context,
    schema: z.ZodType<TValue>,
  ): Promise<TValue> => schema.parse(await c.req.json());

  // `orderBy` is an enum rather than a string so a column outside the allowlist
  // is a 400 at validation time and shows up in the OpenAPI document. The
  // service keeps its own allowlist check as defence in depth.
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

  const invalidIdentifier = { description: "Invalid identifier" };
  const editorial = definition.editorial.enabled;

  // An editorial content type answers both conflict kinds with a JSON body, so
  // a client can tell "someone saved first" from "that value is taken" and act
  // on the difference. Everything else keeps the plain-text 409 it has always
  // returned - a Stage 1-3 route's contract does not change.
  const uniqueConflict = editorial
    ? jsonResponse(
        zodContentConflict,
        "A record with these values already exists, or the version moved",
      )
    : { description: "A record with these values already exists" };

  /**
   * The editorial service, for a route that only exists when there is one.
   *
   * The plugin id travels in rather than being read from the request: a
   * revision is stamped with its owner, and `c.get("plugin")` is the plugin
   * handling the request, which is only the same thing by coincidence.
   */
  const editorialService = (c: Context) => {
    const build = model.editorialService;
    if (!build) {
      throw new HTTPException(500, {
        message: "This content type has no editorial workflow.",
      });
    }

    return build(c, { pluginId });
  };

  const previewEnabled = definition.editorial.preview.enabled;

  /**
   * The secret from the boot config, falling back to the env getter.
   *
   * The fallback matters for a direct `app.request()` in a test, which does not
   * go through the global middleware that populates `core`.
   */
  const previewSecret = (c: Context): string =>
    c.get("core")?.contentPreviewSecret ?? CONFIG.contentPreviewSecret;

  /**
   * Where the link points.
   *
   * With a `pathTemplate` it is a page in the web app, which is what an editor
   * wants to send a reviewer. Without one it is the JSON endpoint - honest
   * rather than a link to a page nobody has written yet.
   */
  const previewUrl = (token: string): string =>
    definition.editorial.preview.pathTemplate
      ? definition.editorial.preview.pathTemplate.replace(
          CONTENT_PREVIEW_TOKEN_PLACEHOLDER,
          encodeURIComponent(token),
        )
      : `/api/${pluginId}/content/${definition.publicApi.path}/preview/${encodeURIComponent(token)}`;

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
        400: { description: "Invalid query parameters" },
      },
    },
    handler: async c => {
      // The whole query string goes through both schemas, each of which reads
      // only the keys it owns:
      //
      //   paginationQuery   cursor, first, last, order, orderBy, search
      //   schemas.filters   one entry per declared filterable field
      //
      // Neither is strict, so anything else - a stale bookmark, a tracking
      // parameter - is ignored rather than turned into a 400. `orderBy` is the
      // exception: it is a literal enum, so a *present* but unknown column is a
      // 400 at validation time.
      const raw = c.req.query();
      const { cursor, first, last, order, orderBy, search } =
        paginationQuery.parse(raw);
      // Every value is coerced here (query strings carry numbers and booleans as
      // text), and an unsupported field cannot survive the parse - so this path
      // never hands `buildFilterCondition` a kind it rejects. The service checks
      // kind and nullability again for callers that did not come through here.
      const filters = schemas.filters.parse(raw) as ContentFilterInput<
        typeof definition
      >;

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
        400: { description: "Not a relation or user field" },
      },
    },
    handler: async c => {
      const field = c.req.param("field");
      if (!isReferenceField(field)) {
        throw new HTTPException(400, {
          message: "This field has no picker.",
        });
      }

      const items = await model
        .service(c)
        .options(field, c.req.query("search"));

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
        400: invalidIdentifier,
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
        409: uniqueConflict,
      },
    },
    handler: async c => {
      const values = await readJson(c, schemas.create);

      // An editorial content type creates through the transactional service, so
      // the row and its first revision land together - a record whose history
      // starts at "edited" would have nothing to restore back to.
      if (editorial) {
        const result = await withHttpErrors(
          "create",
          async () =>
            await editorialService(c).create(values, {
              actor: resolveContentActor(c),
            }),
          { contentTypeId: definition.id, structured: true },
        );

        await contentEditorialEffects(c, definition, result, { pluginId });

        return c.json(result.row, 201);
      }

      const row = await withHttpErrors("create", async () =>
        model.service(c).create(values),
      );

      // Emitted only once the write has returned, never inside a transaction.
      await emitContentEvent(c, definition, "created", { contentId: row.id });

      // A new record is a draft, so this normally indexes nothing - but it is
      // computed from the row rather than assumed, the same way the Server
      // Action computes its cache tags.
      await syncContentSearch(c, definition, {
        operation: "create",
        pluginId,
        row,
      });

      return c.json(row, 201);
    },
  });

  /**
   * The editorial `PUT`: same path and method, one extra key in the body.
   *
   * `expectedVersion` sits beside `values` rather than inside it because
   * `schemas.update` is a strict object of the content type's own fields, and a
   * precondition is transport, not content. It is required rather than
   * optional - an update that does not say which version it read is exactly the
   * lost write this stage exists to prevent.
   */
  const editorialUpdate = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.edit },
    route: {
      method: "put",
      path: "/{id}",
      description: `Update a ${label.singular}`,
      request: {
        params: schemas.params,
        body: jsonBody(schemas.updateEnvelope),
      },
      responses: {
        200: jsonResponse(
          schemas.selectObject,
          `${label.singular} updated successfully`,
        ),
        400: { description: "Invalid or empty payload" },
        404: { description: `${label.singular} not found` },
        409: uniqueConflict,
      },
    },
    handler: async c => {
      const id = identifier(c);
      const { expectedVersion, values } = await readJson(
        c,
        schemas.updateEnvelope,
      );

      const result = await withHttpErrors(
        "update",
        async () =>
          await editorialService(c).update(id, values, {
            actor: resolveContentActor(c),
            expectedVersion,
          }),
        { contentTypeId: definition.id, itemId: id, structured: true },
      );
      if (!result) throw notFound(definition);

      // One call rather than an event branch plus a search branch: which event
      // and which search operation an outcome deserves is a rule, and it is
      // stated once, in `contentEditorialEffects`.
      await contentEditorialEffects(c, definition, result, { pluginId });

      return c.json(result.row, 200);
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
        409: uniqueConflict,
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

      // A slug change is just a rewritten `url`: the search document is keyed by
      // item type and id, so there is no stale document to clean up.
      await syncContentSearch(c, definition, {
        changedFields: result.changedFields,
        operation: "update",
        pluginId,
        row: result.row,
      });

      return c.json(result.row, 200);
    },
  });

  // Publishing is a domain operation, not a field update: `status` and
  // `publishedAt` are absent from the strict create/update schemas, so these
  // two routes are the only way to move them over HTTP. Both are idempotent -
  // publishing an already-published record is a 200 that changed nothing.
  const publicationRoute = (action: "publish" | "unpublish") =>
    buildRoute({
      pluginId,
      adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.publish },
      route: {
        method: "post",
        path: `/{id}/${action}` as const,
        description: `${action === "publish" ? "Publish" : "Unpublish"} a ${label.singular}`,
        request: { params: schemas.params },
        responses: {
          200: jsonResponse(
            publicationResponse,
            `${label.singular} ${action}ed, or already in that state`,
          ),
          400: invalidIdentifier,
          404: { description: `${label.singular} not found` },
        },
      },
      handler: async c => {
        const id = identifier(c);

        if (editorial) {
          const result = await withHttpErrors(
            "update",
            async () =>
              await editorialService(c)[action](id, {
                actor: resolveContentActor(c),
              }),
            { contentTypeId: definition.id, itemId: id, structured: true },
          );
          if (!result) throw notFound(definition);

          // Still idempotent: a no-op outcome emits nothing, indexes nothing
          // and - because the version did not move - leaves no revision.
          await contentEditorialEffects(c, definition, result, { pluginId });

          return c.json({ changed: result.changed, row: result.row }, 200);
        }

        const service = publicationMethods(definition, model.service(c));

        const result = await withHttpErrors(
          "update",
          async () => await service[action](id),
        );
        if (!result) throw notFound(definition);

        // A no-op emits nothing: there is no outbox, so a listener that fires
        // on every button press would be doing duplicate work for free.
        if (result.changed) {
          await emitContentEvent(
            c,
            definition,
            action === "publish" ? "published" : "unpublished",
            action === "publish" && result.publishedAt
              ? { contentId: id, publishedAt: result.publishedAt }
              : { contentId: id },
          );
        }

        await syncContentSearch(c, definition, {
          changed: result.changed,
          operation: action,
          pluginId,
          row: result.row,
        });

        return c.json({ changed: result.changed, row: result.row }, 200);
      },
    });

  const zodRevisionMeta = z.object({
    actorName: z.string().nullable(),
    actorType: z.enum(CONTENT_ACTOR_TYPES),
    actorUserId: z.number().nullable(),
    changedFields: z.array(z.string()),
    createdAt: z.union([z.date(), z.string()]),
    id: z.number(),
    operation: z.enum(CONTENT_REVISION_OPERATIONS),
    restoredFromRevisionId: z.number().nullable(),
    version: z.number(),
  });

  // `.loose()`: a snapshot is data this content type wrote, and its shape moves
  // with the content type. Describing it as a closed object would make every
  // field rename a breaking response schema.
  const zodRevisionDetail = zodRevisionMeta.extend({
    snapshot: z.object({}).loose(),
  });

  const revisionParams = z.object({
    id: z.coerce.number(),
    revisionId: z.coerce.number(),
  });

  const revisionIdentifier = (c: Context): number => {
    const value = Number(c.req.param("revisionId"));
    if (!Number.isInteger(value) || value <= 0) {
      throw new HTTPException(400, { message: "Invalid revision identifier." });
    }

    return value;
  };

  const revisionList = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.view },
    route: {
      method: "get",
      path: "/{id}/revisions",
      description: `History of one ${label.singular}`,
      request: {
        params: schemas.params,
        query: z.object({
          cursor: z.coerce.number().optional(),
          first: z.coerce.number().optional(),
        }),
      },
      responses: {
        200: jsonResponse(
          z.object({ edges: z.array(zodRevisionMeta) }),
          "Revisions, newest first",
        ),
        400: invalidIdentifier,
      },
    },
    handler: async c => {
      // Metadata only. Opening the history must not drag every historical
      // snapshot of a long article across the wire; the detail route loads one
      // on demand.
      const edges = await editorialService(c).revisions.list(identifier(c), {
        cursor: c.req.query("cursor")
          ? Number(c.req.query("cursor"))
          : undefined,
        limit: c.req.query("first") ? Number(c.req.query("first")) : undefined,
      });

      return c.json({ edges }, 200);
    },
  });

  const revisionDetail = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.view },
    route: {
      method: "get",
      path: "/{id}/revisions/{revisionId}",
      description: `One revision of a ${label.singular}, with its snapshot`,
      request: { params: revisionParams },
      responses: {
        200: jsonResponse(zodRevisionDetail, "Revision found"),
        400: invalidIdentifier,
        404: { description: "Revision not found" },
      },
    },
    handler: async c => {
      // Scoped by the record in the URL as well as the revision id - the
      // revisions table is shared by every editorial content type in the
      // install, so an id on its own proves nothing about ownership.
      const revision = await editorialService(c).revisions.findById(
        identifier(c),
        revisionIdentifier(c),
      );
      if (!revision) {
        throw new HTTPException(404, { message: "Revision not found." });
      }

      return c.json(revision, 200);
    },
  });

  const restore = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.restore },
    route: {
      method: "post",
      path: "/{id}/revisions/{revisionId}/restore",
      description: `Restore a ${label.singular} to an earlier revision`,
      request: {
        params: revisionParams,
        body: jsonBody(
          z.strictObject({ expectedVersion: z.number().int().positive() }),
        ),
      },
      responses: {
        200: jsonResponse(
          z.object({ changed: z.boolean(), row: schemas.selectObject }),
          `${label.singular} restored, or already at those values`,
        ),
        400: invalidIdentifier,
        404: { description: "Revision not found" },
        409: uniqueConflict,
        422: jsonResponse(
          zodContentUnprocessable,
          "The revision no longer fits this content type",
        ),
      },
    },
    handler: async c => {
      const id = identifier(c);
      const revisionId = revisionIdentifier(c);
      const { expectedVersion } = await readJson(
        c,
        z.strictObject({ expectedVersion: z.number().int().positive() }),
      );

      const result = await withHttpErrors(
        "update",
        async () =>
          await editorialService(c).restore(id, revisionId, {
            actor: resolveContentActor(c),
            expectedVersion,
          }),
        { contentTypeId: definition.id, itemId: id, structured: true },
      );
      if (!result) {
        throw new HTTPException(404, { message: "Revision not found." });
      }

      await contentEditorialEffects(c, definition, result, { pluginId });

      return c.json({ changed: result.changed, row: result.row }, 200);
    },
  });

  /**
   * Mints a preview link for the record's newest revision.
   *
   * `can_view` rather than `can_edit`: a preview shows what the public route
   * would show, so anyone allowed to read the record in the AdminCP is already
   * allowed to see this. The link itself is the credential from there on.
   *
   * The token is minted on demand, never handed out with the list payload -
   * a table of 25 rows must not be 25 live bearer tokens for unpublished
   * records sitting in a browser's memory.
   */
  const previewToken = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.view },
    route: {
      method: "post",
      path: "/{id}/preview",
      description: `Create a preview link for one ${label.singular}`,
      request: { params: schemas.params },
      responses: {
        200: jsonResponse(
          z.object({
            expiresAt: z.date(),
            /** `0` when the record predates its content type opting in. */
            revisionId: z.number(),
            token: z.string(),
            url: z.string(),
            version: z.number(),
          }),
          "Preview link created",
        ),
        400: invalidIdentifier,
        404: { description: `${label.singular} not found` },
      },
    },
    handler: async c => {
      const id = identifier(c);

      const row = await model.service(c).findById(id);
      if (!row) throw notFound(definition);

      // The newest revision is the one the editor was just looking at, and the
      // last one retention will prune - so a shared link stays resolvable for
      // as long as any link would.
      const latest = await editorialService(c).revisions.latest(id);
      const version = (row as Record<string, unknown>).version;

      const { expiresAt, token } = createContentPreviewToken({
        definition,
        itemId: id,
        pluginId,
        revisionId: latest?.id ?? 0,
        secret: previewSecret(c),
        version: latest?.version ?? (typeof version === "number" ? version : 1),
      });

      return c.json(
        {
          expiresAt,
          revisionId: latest?.id ?? 0,
          token,
          url: previewUrl(token),
          version:
            latest?.version ?? (typeof version === "number" ? version : 1),
        },
        200,
      );
    },
  });

  const zodSchedule = z.object({
    action: z.enum(CONTENT_SCHEDULE_ACTIONS),
    actorName: z.string().nullable(),
    completedAt: z.union([z.date(), z.string()]).nullable(),
    createdAt: z.union([z.date(), z.string()]),
    createdBy: z.number().nullable(),
    id: z.number(),
    lastError: z.string().nullable(),
    scheduledFor: z.union([z.date(), z.string()]),
    status: z.enum(CONTENT_SCHEDULE_STATUSES),
  });

  /** The schedules model, for a route that only exists when there is one. */
  const schedulesModel = (c: Context) => {
    const schedules = editorialService(c).schedules;
    if (!schedules) {
      throw new HTTPException(500, {
        message: "This content type has no scheduling.",
      });
    }

    return schedules;
  };

  const scheduleList = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.view },
    route: {
      method: "get",
      path: "/{id}/schedules",
      description: `Pending and recent schedules for one ${label.singular}`,
      request: { params: schemas.params },
      responses: {
        200: jsonResponse(
          z.object({
            edges: z.array(zodSchedule),
            /**
             * Whether an in-process scheduler is actually running.
             *
             * Carried on this route rather than read from the debug endpoint,
             * which needs a different permission the editor may not have. It is
             * not sensitive - it says whether background jobs run - and without
             * it the dialog would happily accept schedules that never fire.
             */
            hasCronAdapter: z.boolean(),
          }),
          "Pending schedules first, then the most recent settled ones",
        ),
        400: invalidIdentifier,
      },
    },
    handler: async c => {
      const edges = await schedulesModel(c).listForItem(identifier(c));

      return c.json(
        { edges, hasCronAdapter: c.get("core")?.hasCronAdapter ?? false },
        200,
      );
    },
  });

  const scheduleCreate = buildRoute({
    pluginId,
    // `can_publish`, not `can_edit`: booking a publication *is* publishing, just
    // later. A role trusted to write drafts is not automatically trusted to put
    // one on the internet at 9am on Monday.
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.publish },
    route: {
      method: "post",
      path: "/{id}/schedule",
      description: `Schedule a ${label.singular} to publish or unpublish later`,
      request: {
        params: schemas.params,
        body: jsonBody(
          z.strictObject({
            action: z.enum(CONTENT_SCHEDULE_ACTIONS),
            scheduledFor: z.iso.datetime(),
          }),
        ),
      },
      responses: {
        200: jsonResponse(
          z.object({
            generation: z.number(),
            id: z.number(),
            scheduledFor: z.union([z.date(), z.string()]),
          }),
          "Scheduled",
        ),
        400: jsonResponse(
          zodContentScheduleRejection,
          "That time will not work",
        ),
        404: { description: `${label.singular} not found` },
      },
    },
    handler: async c => {
      const id = identifier(c);
      const { action, scheduledFor } = await readJson(
        c,
        z.strictObject({
          action: z.enum(CONTENT_SCHEDULE_ACTIONS),
          scheduledFor: z.iso.datetime(),
        }),
      );

      // Checked before anything is written: scheduling a publication for a
      // record that is not there would be a row nothing can ever act on.
      const row = await model.service(c).findById(id);
      if (!row) throw notFound(definition);

      const actor = resolveContentActor(c);
      const result = await withHttpErrors(
        "update",
        async () =>
          await schedulesModel(c).schedule({
            action,
            actorUserId: actor.userId,
            itemId: id,
            scheduledFor: new Date(scheduledFor),
          }),
        { contentTypeId: definition.id, itemId: id, structured: true },
      );

      // Scheduling changes no field value, so it writes no revision and burns
      // no version - but it is still something other plugins may want to react
      // to, so it gets an event of its own.
      await emitContentEvent(c, definition, "scheduled", {
        action,
        actorUserId: actor.userId,
        contentId: id,
        scheduledFor: result.scheduledFor,
        scheduleId: result.id,
      } as never);

      return c.json(result, 200);
    },
  });

  const scheduleCancel = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.publish },
    route: {
      method: "post",
      path: "/{id}/schedule/{scheduleId}/cancel",
      description: `Cancel a pending schedule for one ${label.singular}`,
      request: {
        params: z.object({
          id: z.coerce.number(),
          scheduleId: z.coerce.number(),
        }),
      },
      responses: {
        200: jsonResponse(z.object({ cancelled: z.boolean() }), "Cancelled"),
        400: invalidIdentifier,
        404: { description: "Schedule not found" },
      },
    },
    handler: async c => {
      const id = identifier(c);
      const scheduleId = Number(c.req.param("scheduleId"));
      if (!Number.isInteger(scheduleId) || scheduleId <= 0) {
        throw new HTTPException(400, {
          message: "Invalid schedule identifier.",
        });
      }

      // Scoped by the record in the URL as well as the schedule id: the table
      // is shared, so an id alone proves nothing about ownership.
      const cancelled = await schedulesModel(c).cancel(id, scheduleId);
      if (!cancelled) {
        throw new HTTPException(404, { message: "Schedule not found." });
      }

      const actor = resolveContentActor(c);
      await emitContentEvent(c, definition, "schedule_cancelled", {
        action: cancelled.action,
        actorUserId: actor.userId,
        contentId: id,
        scheduleId,
      } as never);

      // The queued task is deliberately left alone. It will wake up, find the
      // row cancelled, and do nothing - which is far more reliable than trying
      // to hunt down and delete a queue row.
      return c.json({ cancelled: true }, 200);
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
        400: invalidIdentifier,
        404: { description: `${label.singular} not found` },
        409: { description: "Still referenced by other content" },
      },
    },
    handler: async c => {
      const id = identifier(c);

      // The history outlives the record: a final `delete` revision is what makes
      // "who removed this, and what did it say" answerable afterwards.
      if (editorial) {
        const result = await withHttpErrors(
          "delete",
          async () =>
            await editorialService(c).delete(id, {
              actor: resolveContentActor(c),
            }),
          { contentTypeId: definition.id, itemId: id, structured: true },
        );
        if (!result) throw notFound(definition);

        await contentEditorialEffects(c, definition, result, { pluginId });

        return c.json(result.row, 200);
      }

      const row = await withHttpErrors("delete", async () =>
        model.service(c).delete(id),
      );
      if (!row) throw notFound(definition);

      await emitContentEvent(c, definition, "deleted", { contentId: row.id });

      // `publishedAt` survives an unpublish, so a record that was ever published
      // is removed from the index defensively - a delete of a document that is
      // not there costs one statement and repairs any drift.
      await syncContentSearch(c, definition, {
        operation: "delete",
        pluginId,
        row,
      });

      return c.json(row, 200);
    },
  });

  return [
    list,
    options,
    detail,
    create,
    // Same method and path either way; only the body shape differs, so exactly
    // one of the two is ever mounted.
    editorial ? editorialUpdate : update,
    remove,
    ...(definition.publication.enabled
      ? [publicationRoute("publish"), publicationRoute("unpublish")]
      : []),
    ...(editorial ? [revisionList, revisionDetail, restore] : []),
    ...(previewEnabled ? [previewToken] : []),
    ...(definition.editorial.scheduling.enabled
      ? [scheduleList, scheduleCreate, scheduleCancel]
      : []),
  ];
};

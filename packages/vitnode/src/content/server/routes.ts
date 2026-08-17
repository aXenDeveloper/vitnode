import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import type {
  AnyContentTypeDefinition,
  ContentFilterInput,
  ContentOrderableFieldName,
  ContentReferenceFieldName,
} from "../types";
import type { AnyContentModel, ContentModel } from "./model";
import type { ContentPreviewTarget } from "./preview-target";

import { buildRoute } from "../../api/lib/route";
import {
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "../../api/lib/with-pagination";
import { contentTypeName } from "../admin/labels";
import {
  zodContentConflict,
  zodContentDeliveryConflict,
  zodContentScheduleRejection,
  zodContentUnprocessable,
} from "../conflicts";
import {
  CONTENT_ACTOR_TYPES,
  CONTENT_LOCALE_MAX_LENGTH,
  CONTENT_OPTIONS_LIMIT,
  CONTENT_PERMISSIONS,
  CONTENT_REVISION_OPERATIONS,
  CONTENT_SCHEDULE_ACTIONS,
  CONTENT_SCHEDULE_STATUSES,
} from "../const";
import { partitionContentFields } from "../localization";
import { orderableColumns } from "../registry";
import { resolveContentActor } from "./actor";
import { contentEditorialEffects } from "./editorial-effects";
import { emitContentEvent } from "./emit";
import { withHttpErrors } from "./http-errors";
import { findContentLanguage } from "./language-resolver";
import { buildContentLocalizedAdminRoutes } from "./localized-admin-routes";
import {
  assertContentPreviewIsServable,
  contentPreviewSecret,
  contentPreviewUrl,
} from "./preview-link";
import { resolveContentPreviewTarget } from "./preview-target";
import { createContentPreviewToken } from "./preview-token";
import { publicationMethods } from "./publication";
import { CONTENT_REVISIONS_MAX_PAGE_SIZE } from "./revisions-model";
import { contentSearchAdvancedValues, syncContentSearch } from "./search-sync";
import { buildContentTranslationRoutes } from "./translation-routes";

const zodLabels = z.record(z.string(), z.string().nullable());

const zodOptions = z.object({
  items: z.array(
    z.object({
      /**
       * Present only for a `user` field, where an option is a person rather than
       * a row with a name. Optional rather than a second response shape, so a
       * client written before this still parses every option it gets.
       */
      avatarColor: z.string().optional(),
      /**
       * Present when the target declares `admin.colorField` - a blog category
       * is a colour as much as it is a word, and the picker draws it.
       */
      color: z.string().optional(),
      label: z.string(),
      nameCode: z.string().optional(),
      value: z.number(),
    }),
  ),
});

const notFound = (definition: AnyContentTypeDefinition): HTTPException =>
  new HTTPException(404, {
    message: `${contentTypeName(definition.id)} not found.`,
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
/**
 * The collections a search document is made of, or nothing.
 *
 * Read after the write has returned, and only when the search configuration
 * actually names a collection leaf - `contentSearchAdvancedValues` owns that
 * decision so every effects path answers it identically.
 */
const advancedForSearch = async (
  c: Context,
  model: AnyContentModel,
  row: object,
): Promise<Record<string, unknown> | undefined> => {
  const id = (row as { id?: unknown }).id;

  return typeof id === "number"
    ? await contentSearchAdvancedValues(c, model, id)
    : undefined;
};

export const buildContentRoutes = <
  TDefinition extends AnyContentTypeDefinition,
  P extends string,
>(
  model: ContentModel<TDefinition>,
  { pluginId }: { pluginId: P },
) => {
  const { definition, schemas } = model;
  const module = definition.permissionModule;
  const name = contentTypeName(definition.id);

  const localized = definition.localization.enabled;

  /**
   * One row's state in the language the list is being viewed in.
   *
   * `null` when that language has no translation, which is a state the table
   * renders as `Missing` rather than as an error. Present only on a localized
   * content type, so every other list response is unchanged.
   */
  const zodRowTranslation = z
    .object({
      locale: z.string(),
      publishedAt: z.date().nullable().optional(),
      status: z.string().optional(),
      title: z.string(),
      /**
       * Every localized value of that translation.
       *
       * The list shows localized columns in the reader's own language, so the
       * row it renders is the base row joined to one translation. Loose in its
       * value type because the shape is the content type's own and this schema
       * is generic over all of them.
       */
      values: z.record(z.string(), z.unknown()),
      version: z.number(),
    })
    .nullable();

  /**
   * One record, as the form that edits it needs it: the base row, the labels
   * behind its to-one references, **and** its collections.
   *
   * The collections are the part a list response deliberately leaves out - two
   * queries per collection field is one page of the table's worth of round trips
   * - but a detail read is one record, and the form editing it holds every
   * to-many reference and every repeatable it has. Without them the edit form
   * opens on the empty set for each: a `min: 1` field is then invalid the moment
   * it loads, so the Save button never enables, and one that saves anyway saves
   * an emptied collection.
   *
   * `schemas.advancedSelect` is empty for a content type that declares neither,
   * so this stays byte-identical to what it was for every other one.
   */
  const detailRow = schemas.selectObject.extend({
    labels: zodLabels,
    ...schemas.advancedSelect.shape,
  });
  const listRow = schemas.selectObject.extend({
    labels: zodLabels,
    ...(localized ? { translation: zodRowTranslation.optional() } : {}),
  });
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
  // A content type with `delivery.redirects` adds a third arm: an address another
  // record's URL history still owns. Declared as a union with the editorial pair
  // rather than replacing it, so a client generated before Stage 8 still parses the
  // two arms it knows and only fails to recognise the new one.
  const conflictSchema =
    definition.delivery.enabled && definition.delivery.redirects.enabled
      ? z.union([zodContentConflict, zodContentDeliveryConflict])
      : zodContentConflict;

  const uniqueConflict = editorial
    ? jsonResponse(
        conflictSchema,
        definition.delivery.redirects.enabled
          ? "A record with these values already exists, the version moved, or the address is reserved by a historical URL"
          : "A record with these values already exists, or the version moved",
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

  const previewSecret = contentPreviewSecret;
  const previewUrl = (token: string, target: ContentPreviewTarget): string =>
    contentPreviewUrl({
      definition,
      locale: target.locale,
      pluginId,
      slug: target.slug,
      token,
    });
  const assertPreviewIsServable = assertContentPreviewIsServable;

  const list = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.view },
    route: {
      method: "get",
      path: "/",
      description: `List ${name} records`,
      request: {
        query: paginationQuery.extend({
          ...schemas.filters.shape,
          // The language the list is being *viewed* in. It never filters: an
          // admin list is a list of records, and hiding the ones a translator has
          // not reached yet is the opposite of what the selector is for.
          ...(localized
            ? {
                locale: z
                  .string()
                  .min(1)
                  .max(CONTENT_LOCALE_MAX_LENGTH)
                  .optional(),
              }
            : {}),
        }),
      },
      responses: {
        200: jsonResponse(
          z.object({
            edges: z.array(listRow),
            pageInfo: zodPaginationPageInfo,
          }),
          `${name} records retrieved successfully`,
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
        // `orderBy` came out of a `z.enum(orderableColumns(definition))`, which
        // is the same allowlist `ContentOrderableFieldName` approximates - but
        // that type is still deferred here, because `TDefinition` is open. The
        // service re-checks the name against the runtime allowlist regardless.
        orderBy: {
          column: orderBy as ContentOrderableFieldName<TDefinition>,
          order,
        },
        query: { cursor, first, last, search },
      });

      return c.json(await withRowTranslations(c, data, raw.locale), 200);
    },
  });

  /**
   * Attaches each row's translation in the language the list is being viewed in.
   *
   * One extra query for the whole page rather than a join, and deliberately so:
   * the list is a query over the base table and its pagination, ordering and
   * filters are all defined there. Joining a translation in would make the page
   * size depend on how many languages a record has - and adding it afterwards
   * keeps every existing list behaving exactly as it did.
   *
   * A locale with no translation comes back as `null` rather than being dropped:
   * an admin list is a list of *records*, and the whole point of the selector is
   * to see which ones a translator has not reached yet.
   */
  const withRowTranslations = async (
    c: Context,
    data: { edges: { id: number }[]; pageInfo: unknown },
    locale: string | undefined,
  ) => {
    const build = model.translationService;
    if (!localized || !build || locale === undefined || locale.trim() === "") {
      return data;
    }

    const language = await findContentLanguage(c, locale);
    // An unknown locale reads as "no translation in that language" rather than
    // as an error: the selector is a view control, and a stale bookmark naming a
    // language that has since been removed should still show the list.
    if (!language) {
      return {
        ...data,
        edges: data.edges.map(row => ({ ...row, translation: null })),
      };
    }

    const translations = build(c);
    // The first localized text field, in declaration order - the same rule the
    // locale editor's tab titles follow, so the list and the editor agree about
    // which value names a translation.
    const titleField =
      Object.entries(
        partitionContentFields(definition.fields).localizedFields,
      ).find(([, fieldValue]) => fieldValue.kind === "text")?.[0] ?? null;

    // One `WHERE itemId IN (...) AND languageId = ?` for the whole page. A
    // translation is keyed by `(itemId, languageId)`, so this reads at most one
    // row per record and needs no ordering to stay unambiguous.
    const rows = await translations.findManyByLanguageId(
      data.edges.map(row => row.id),
      language.id,
    );
    const byId = new Map<number, (typeof rows)[number]>(
      rows.map(row => [row.itemId as number, row]),
    );

    return {
      ...data,
      edges: data.edges.map(row => {
        const translation = byId.get(row.id);
        if (!translation) return { ...row, translation: null };

        const values = translation.values as Record<string, unknown>;
        const meta = translation as unknown as Record<string, unknown>;

        return {
          ...row,
          translation: {
            locale: translation.locale,
            ...(definition.publication.enabled
              ? {
                  publishedAt: meta.publishedAt as Date | null,
                  status: meta.status as string,
                }
              : {}),
            title:
              titleField === null
                ? ""
                : typeof values[titleField] === "string"
                  ? values[titleField]
                  : "",
            values,
            version: translation.version,
          },
        };
      }),
    };
  };

  const options = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.view },
    route: {
      method: "get",
      path: "/options/{field}",
      description: `Picker options for a ${name} relation`,
      request: {
        params: z.object({ field: z.string() }),
        query: z.object({
          /**
           * Label these identifiers instead of searching - a comma-separated
           * list, because a query string is where this arrives from.
           *
           * How a form that opens holding references shows names for them. A
           * to-many field has no label on the row it belongs to, so without this
           * an editor would open their article and find their co-authors listed
           * as `7` and `12`.
           */
          ids: z.string().optional(),
          search: z.string().optional(),
        }),
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

      const raw = c.req.query("ids");
      // Anything that is not a whole number is dropped rather than refused: the
      // list is a lookup key, and one malformed entry should cost that entry
      // rather than the whole form's labels.
      const ids =
        raw === undefined
          ? undefined
          : raw
              .split(",")
              .map(value => Number(value.trim()))
              .filter(value => Number.isInteger(value));

      const items = await model
        .service(c)
        .options(field, c.req.query("search"), ids);

      return c.json({ items }, 200);
    },
  });

  const detail = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.view },
    route: {
      method: "get",
      path: "/{id}",
      description: `Get one ${name}`,
      request: { params: schemas.params },
      responses: {
        // `labels` alongside the record, the same way the list returns them:
        // a `relation` holds an identifier, and the form that edits it has to
        // show the name behind it. Additive to the row every earlier client
        // already parses.
        200: jsonResponse(detailRow, `${name} found`),
        400: invalidIdentifier,
        404: { description: `${name} not found` },
      },
    },
    handler: async c => {
      const id = identifier(c);
      const service = model.service(c);
      const row = await service.findRowById(id);
      if (!row) throw notFound(definition);

      // Two queries per collection field, and none at all for a content type
      // that declares none - `advanced` is the no-op store then. Spread after
      // the row because a collection is never one of its columns.
      return c.json({ ...row, ...(await service.advanced(id)) }, 200);
    },
  });

  const create = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.create },
    route: {
      method: "post",
      path: "/",
      description: `Create a ${name}`,
      request: { body: jsonBody(schemas.create) },
      responses: {
        201: jsonResponse(schemas.selectObject, `${name} created successfully`),
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

        await contentEditorialEffects(c, definition, result, {
          model,
          pluginId,
        });

        return c.json(result.row, 201);
      }

      const row = await withHttpErrors("create", async () =>
        model.service(c).create(values),
      );

      // Emitted only once the write has returned, never inside a transaction.
      // `pluginId` is passed on every content event, interactive or scheduled,
      // so the envelope's owner is the content type's plugin rather than
      // whichever module happened to invoke the helper.
      await emitContentEvent(
        c,
        definition,
        "created",
        { contentId: row.id },
        { pluginId },
      );

      // A new record is a draft, so this normally indexes nothing - but it is
      // computed from the row rather than assumed, the same way the Server
      // Action computes its cache tags.
      await syncContentSearch(c, definition, {
        advanced: await advancedForSearch(c, model, row),
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
      description: `Update a ${name}`,
      request: {
        params: schemas.params,
        body: jsonBody(schemas.updateEnvelope),
      },
      responses: {
        200: jsonResponse(schemas.selectObject, `${name} updated successfully`),
        400: { description: "Invalid or empty payload" },
        404: { description: `${name} not found` },
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
      await contentEditorialEffects(c, definition, result, { model, pluginId });

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
      description: `Update a ${name}`,
      request: { params: schemas.params, body: jsonBody(schemas.update) },
      responses: {
        200: jsonResponse(schemas.selectObject, `${name} updated successfully`),
        400: { description: "Invalid or empty payload" },
        404: { description: `${name} not found` },
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
        await emitContentEvent(
          c,
          definition,
          "updated",
          {
            changedFields: result.changedFields,
            contentId: result.row.id,
          },
          { pluginId },
        );
      }

      // A slug change is just a rewritten `url`: the search document is keyed by
      // item type and id, so there is no stale document to clean up.
      await syncContentSearch(c, definition, {
        advanced: await advancedForSearch(c, model, result.row),
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
        description: `${action === "publish" ? "Publish" : "Unpublish"} a ${name}`,
        request: { params: schemas.params },
        responses: {
          200: jsonResponse(
            publicationResponse,
            `${name} ${action}ed, or already in that state`,
          ),
          400: invalidIdentifier,
          404: { description: `${name} not found` },
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
          await contentEditorialEffects(c, definition, result, {
            model,
            pluginId,
          });

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
            { pluginId },
          );
        }

        await syncContentSearch(c, definition, {
          advanced: await advancedForSearch(c, model, result.row),
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
    actorRoleColor: z.string().nullable(),
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

  /**
   * The history cursor is a **version**, so both bounds are real constraints:
   * versions start at 1, and a page larger than the cap would let one request
   * pull an entire record's history.
   */
  const revisionQuery = z.object({
    cursor: z.coerce.number().int().positive().optional(),
    first: z.coerce
      .number()
      .int()
      .min(1)
      .max(CONTENT_REVISIONS_MAX_PAGE_SIZE)
      .optional(),
  });

  const revisionList = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.view },
    route: {
      method: "get",
      path: "/{id}/revisions",
      description: `History of one ${name}`,
      request: { params: schemas.params, query: revisionQuery },
      responses: {
        200: jsonResponse(
          z.object({
            edges: z.array(zodRevisionMeta),
            pageInfo: z.object({
              /** The last version on this page. Pass it back as `cursor`. */
              endCursor: z.number().nullable(),
              hasNextPage: z.boolean(),
            }),
          }),
          "Revisions, newest first",
        ),
        400: { description: "Invalid query parameters" },
      },
    },
    handler: async c => {
      // Parsed through the same schema the route declares, rather than
      // re-derived with `Number(...)`: `?first=abc` is a 400 here and `NaN`
      // there, and `NaN` would silently fall through to the default page size.
      const { cursor, first } = revisionQuery.parse(c.req.query());

      // Metadata only. Opening the history must not drag every historical
      // snapshot of a long article across the wire; the detail route loads one
      // on demand.
      const page = await editorialService(c).revisions.list(identifier(c), {
        cursor,
        limit: first,
      });

      return c.json(page, 200);
    },
  });

  const revisionDetail = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.view },
    route: {
      method: "get",
      path: "/{id}/revisions/{revisionId}",
      description: `One revision of a ${name}, with its snapshot`,
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
      description: `Restore a ${name} to an earlier revision`,
      request: {
        params: revisionParams,
        body: jsonBody(
          z.strictObject({ expectedVersion: z.number().int().positive() }),
        ),
      },
      responses: {
        200: jsonResponse(
          z.object({ changed: z.boolean(), row: schemas.selectObject }),
          `${name} restored, or already at those values`,
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

      await contentEditorialEffects(c, definition, result, { model, pluginId });

      return c.json({ changed: result.changed, row: result.row }, 200);
    },
  });

  /**
   * The delivery state of one record: where it lives, and where it used to.
   *
   * `can_view` rather than a permission of its own, and deliberately so. This is
   * read-only - it reports what the slug mutations already did - so the permission
   * that allowed the mutation is the only one it needs, and inventing a
   * `can_manage_redirects` for a screen that manages nothing would be a permission
   * every install has to configure for no decision it can make.
   *
   * `locale` scopes it to one language on a content type whose slug is localized,
   * which is what lets the AdminCP's Polish tab show Polish URLs and nothing else.
   */
  const deliveryDetail = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.view },
    route: {
      method: "get",
      path: "/{id}/delivery",
      description: `Canonical URL and historical URLs of one ${name}`,
      request: {
        params: schemas.params,
        query: z.object({
          locale: z.string().min(1).max(CONTENT_LOCALE_MAX_LENGTH).optional(),
        }),
      },
      responses: {
        200: jsonResponse(
          z.object({
            /** `null` while the record has no public URL - a draft, say. */
            canonicalPath: z.string().nullable(),
            /**
             * Every address it has ever answered to, current one first.
             *
             * `path` is the URL exactly as it was live, which is what somebody's
             * bookmark holds. The storage columns behind it - `languageId`,
             * `pluginId`, the row id - are deliberately absent: they are details of
             * `core_content_slug_history` rather than part of this contract.
             */
            history: z.array(
              z.object({
                createdAt: z.date(),
                path: z.string(),
                retiredAt: z.date().nullable(),
                slug: z.string(),
              }),
            ),
            /** Whether the record is publicly reachable in this language now. */
            isPublic: z.boolean(),
            locale: z.string().nullable(),
          }),
          `Delivery state of one ${name}`,
        ),
        400: invalidIdentifier,
        404: { description: `${name} not found` },
      },
    },
    handler: async c => {
      const build = model.deliveryService;
      if (!build) throw notFound(definition);

      const id = identifier(c);
      const locale = c.req.query("locale");
      const delivery = build(c, { pluginId });

      // The canonical path comes from the public read, so a draft reports `null`
      // rather than a URL that answers 404 - "this is where it *would* live" is a
      // different claim from "this is where it lives", and the panel says so.
      const metadata = await delivery.findById(id, { locale });
      const history = await delivery.history(id, { locale });

      return c.json(
        {
          canonicalPath: metadata?.canonicalPath ?? null,
          history: history.map(entry => ({
            createdAt: entry.createdAt,
            path: entry.path,
            retiredAt: entry.retiredAt,
            slug: entry.slug,
          })),
          isPublic: metadata !== null,
          locale: metadata?.locale ?? null,
        },
        200,
      );
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
      description: `Create a preview link for one ${name}`,
      request: { params: schemas.params },
      responses: {
        200: jsonResponse(
          z.object({
            expiresAt: z.date(),
            /** `0` when the record predates its content type opting in. */
            revisionId: z.number(),
            token: z.string(),
            /** Absolute: the web page when one is configured, else the API. */
            url: z.url(),
            version: z.number(),
          }),
          "Preview link created",
        ),
        400: invalidIdentifier,
        404: { description: `${name} not found` },
        503: {
          description:
            "This deployment has no usable web or API origin, so no link can be built",
        },
      },
    },
    handler: async c => {
      // Before the lookup, so a misconfigured install answers the same way for
      // a record that exists and one that does not.
      assertPreviewIsServable();

      const id = identifier(c);

      const row = await model.service(c).findById(id);
      if (!row) throw notFound(definition);

      // The newest revision is the one the editor was just looking at, and the
      // last one retention will prune - so a shared link stays resolvable for
      // as long as any link would.
      const latest = await editorialService(c).revisions.latest(id);
      const version = (row as Record<string, unknown>).version;

      // Which page this previews, and - on a localized content type - which
      // language it is bound to. A localized token *must* carry one: the public
      // preview route resolves a locale for every localized read and refuses a
      // token that names a different one, so a locale-less token would be a link
      // that 404s wherever it pointed.
      const target = await resolveContentPreviewTarget(c, model, { id, row });

      // The translation's own newest revision, so both halves of a localized
      // preview are frozen rather than only the shared one. `0` when there is
      // nothing recorded for that language, which the reader treats as "read it
      // live" - the same answer `revisionId: 0` gets for the base row.
      const translationRevisionId =
        target.locale !== undefined && model.translationEditorialService
          ? ((
              await model
                .translationEditorialService(c, { pluginId })
                .listRevisions(id, target.locale, { limit: 1 })
            ).edges[0]?.id ?? 0)
          : undefined;

      const { expiresAt, token } = createContentPreviewToken({
        definition,
        itemId: id,
        languageId: target.languageId,
        locale: target.locale,
        pluginId,
        revisionId: latest?.id ?? 0,
        secret: await previewSecret(c),
        translationRevisionId,
        version: latest?.version ?? (typeof version === "number" ? version : 1),
      });

      return c.json(
        {
          expiresAt,
          revisionId: latest?.id ?? 0,
          token,
          url: previewUrl(token, target),
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
    /** Set when the transition committed but its announcements have not. */
    effectsError: z.string().nullable(),
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
      description: `Pending and recent schedules for one ${name}`,
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
      description: `Schedule a ${name} to publish or unpublish later`,
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
        404: { description: `${name} not found` },
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
      await emitContentEvent(
        c,
        definition,
        "scheduled",
        {
          action,
          actorUserId: actor.userId,
          contentId: id,
          scheduledFor: result.scheduledFor,
          scheduleId: result.id,
        } as never,
        { pluginId },
      );

      return c.json(result, 200);
    },
  });

  const scheduleCancel = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.publish },
    route: {
      method: "post",
      path: "/{id}/schedule/{scheduleId}/cancel",
      description: `Cancel a pending schedule for one ${name}`,
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
      await emitContentEvent(
        c,
        definition,
        "schedule_cancelled",
        {
          action: cancelled.action,
          actorUserId: actor.userId,
          contentId: id,
          scheduleId,
        } as never,
        { pluginId },
      );

      // The queued task is deliberately left alone. It will wake up, find the
      // row cancelled, and do nothing - which is far more reliable than trying
      // to hunt down and delete a queue row.
      return c.json({ cancelled: true }, 200);
    },
  });

  /** The precondition an editorial delete carries. */
  const deleteEnvelope = z.strictObject({
    expectedVersion: z.number().int().positive(),
  });

  /**
   * The editorial `DELETE`: same path and method, one required body key.
   *
   * A body on a `DELETE` is unusual, and it is still the right shape here: the
   * precondition belongs with the request that acts on it, and the alternative
   * - a query parameter - puts a value that must not be guessed into access
   * logs and browser history.
   *
   * Required rather than optional. Deleting is the widest overwrite there is,
   * and a confirmation dialog that names a record cannot describe a change the
   * person has not seen.
   */
  const editorialRemove = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.delete },
    route: {
      method: "delete",
      path: "/{id}",
      description: `Delete a ${name}`,
      request: { params: schemas.params, body: jsonBody(deleteEnvelope) },
      responses: {
        200: jsonResponse(schemas.selectObject, `${name} deleted successfully`),
        400: invalidIdentifier,
        404: { description: `${name} not found` },
        409: jsonResponse(
          zodContentConflict,
          "Still referenced by other content, or the version moved",
        ),
      },
    },
    handler: async c => {
      const id = identifier(c);
      const { expectedVersion } = await readJson(c, deleteEnvelope);

      // The history outlives the record: a final `delete` revision is what makes
      // "who removed this, and what did it say" answerable afterwards.
      const result = await withHttpErrors(
        "delete",
        async () =>
          await editorialService(c).delete(id, {
            actor: resolveContentActor(c),
            expectedVersion,
          }),
        { contentTypeId: definition.id, itemId: id, structured: true },
      );
      if (!result) throw notFound(definition);

      await contentEditorialEffects(c, definition, result, { model, pluginId });

      return c.json(result.row, 200);
    },
  });

  const remove = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.delete },
    route: {
      method: "delete",
      path: "/{id}",
      description: `Delete a ${name}`,
      request: { params: schemas.params },
      responses: {
        200: jsonResponse(schemas.selectObject, `${name} deleted successfully`),
        400: invalidIdentifier,
        404: { description: `${name} not found` },
        409: { description: "Still referenced by other content" },
      },
    },
    handler: async c => {
      const id = identifier(c);

      const row = await withHttpErrors("delete", async () =>
        model.service(c).delete(id),
      );
      if (!row) throw notFound(definition);

      await emitContentEvent(
        c,
        definition,
        "deleted",
        { contentId: row.id },
        { pluginId },
      );

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
    editorial ? editorialRemove : remove,
    ...(definition.publication.enabled
      ? [publicationRoute("publish"), publicationRoute("unpublish")]
      : []),
    ...(editorial ? [revisionList, revisionDetail, restore] : []),
    ...(previewEnabled ? [previewToken] : []),
    ...(definition.delivery.enabled ? [deliveryDetail] : []),
    ...(definition.editorial.scheduling.enabled
      ? [scheduleList, scheduleCreate, scheduleCancel]
      : []),
    // Mounted under the same module and the same permissions, so a localized
    // content type gets its translation routes without a second registration.
    ...(definition.localization.enabled
      ? [
          ...buildContentTranslationRoutes(model, { pluginId }),
          // The composite pair the AdminCP's single Save button posts to: one
          // transaction across the base row and every language it changed.
          ...buildContentLocalizedAdminRoutes(model, { pluginId }),
        ]
      : []),
  ];
};

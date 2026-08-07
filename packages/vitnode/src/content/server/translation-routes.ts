import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import type {
  AnyContentTypeDefinition,
  ContentLocalizedFieldName,
  ContentTranslationRow,
} from "../types";
import type { ContentModel } from "./model";
import type {
  ContentTranslationEditorialOutcome,
  ContentTranslationEditorialService,
} from "./translation-editorial-service";
import type { ContentTranslationModel } from "./translation-model";

import { buildRoute } from "../../api/lib/route";
import {
  zodContentTranslationConflict,
  zodContentUnprocessable,
} from "../conflicts";
import {
  CONTENT_ACTOR_TYPES,
  CONTENT_LOCALE_MAX_LENGTH,
  CONTENT_PERMISSIONS,
  CONTENT_TRANSLATION_REVISION_OPERATIONS,
} from "../const";
import { resolveContentActor } from "./actor";
import {
  assertContentPreviewIsServable,
  contentPreviewSecret,
  contentPreviewUrl,
} from "./preview-link";
import { createContentPreviewToken } from "./preview-token";
import { contentPublicLocaleStates } from "./public-locales";
import { CONTENT_REVISIONS_MAX_PAGE_SIZE } from "./revisions-model";
import { contentTranslationEffects } from "./translation-effects";
import { withTranslationHttpErrors } from "./translation-http-errors";

/**
 * The generated translation routes for one localized content type.
 *
 * Identity is `(content type, item, locale)` and never the translation row's own
 * key: `(itemId, languageId)` is the primary key, there is no surrogate id to
 * leak, and a locale in the URL cannot be used to reach another content type's
 * translation because the module the route is mounted in already fixes which
 * table is being read. Locales are canonical strings on the outside and numeric
 * `core_languages.id` values on the inside - a client never sends an id, so it can
 * never point one at a language it was not shown.
 *
 * Permissions:
 *
 * | Route | Permission |
 * | --- | --- |
 * | read, history | `can_view` |
 * | create, update | `can_translate` |
 * | publish, unpublish | `can_publish` |
 * | restore | `can_restore` |
 * | delete | `can_delete` |
 *
 * `can_translate` rather than `can_edit`, which is the point of having it: a
 * translator gets every locale tab without gaining the ability to touch a shared
 * field, move the global publication state or delete the record.
 */
export const buildContentTranslationRoutes = <
  TDefinition extends AnyContentTypeDefinition,
  P extends string,
>(
  model: ContentModel<TDefinition>,
  { pluginId }: { pluginId: P },
) => {
  const { definition } = model;
  const schemas = model.translationSchemas;
  const module = definition.permissionModule;
  const label = definition.admin.label;

  if (!schemas || !model.translationService) {
    throw new Error(
      `[Content Engine] ${definition.id}: buildContentTranslationRoutes needs a localized content type.`,
    );
  }

  const translationSchemas = schemas;
  const buildService = model.translationService;
  const buildEditorial = model.translationEditorialService;

  const translations = (c: Context): ContentTranslationModel<TDefinition> =>
    buildService(c);

  /**
   * The editorial layer, for the routes that only exist when there is one.
   *
   * A 500 rather than a graceful degradation: every caller below is behind the
   * `editorial.enabled` check that decides whether the route is built at all, so
   * reaching this is a wiring bug in the engine and not something a request did.
   */
  const editorial = (
    c: Context,
  ): ContentTranslationEditorialService<TDefinition> => {
    if (!buildEditorial) {
      throw new HTTPException(500, {
        message: "This content type has no translation history.",
      });
    }

    return buildEditorial(c, { pluginId });
  };

  const jsonBody = (schema: z.ZodType) => ({
    content: { "application/json": { schema } },
  });
  const jsonResponse = (schema: z.ZodType, description: string) => ({
    content: { "application/json": { schema } },
    description,
  });

  const readJson = async <TValue>(
    c: Context,
    schema: z.ZodType<TValue>,
  ): Promise<TValue> => schema.parse(await c.req.json());

  const identifier = (c: Context): number => {
    const value = Number(c.req.param("id"));
    if (!Number.isInteger(value) || value <= 0) {
      throw new HTTPException(400, { message: "Invalid identifier." });
    }

    return value;
  };

  /**
   * The locale from the URL, length-checked and nothing more.
   *
   * Deliberately not pattern-matched: an unknown locale and a malformed one are
   * both answered by the resolver with the same 404, so a stricter regex here
   * would only move the same outcome earlier. The value is a bound parameter,
   * never an identifier.
   */
  const locale = (c: Context): string => {
    const value = c.req.param("locale") ?? "";
    if (value === "" || value.length > CONTENT_LOCALE_MAX_LENGTH) {
      throw new HTTPException(400, { message: "Invalid locale." });
    }

    return value;
  };

  const conflict = jsonResponse(
    zodContentTranslationConflict,
    "The translation moved, already exists, is the default one, or a localized value is taken",
  );
  const invalidIdentifier = { description: "Invalid identifier or locale" };
  const notFound = {
    description: `${label.singular}, locale or translation not found`,
  };

  /**
   * Announces one translation mutation, once its transaction has committed.
   *
   * Every write route funnels through this rather than calling the effects
   * directly, so "emit exactly one event per real mutation, and none for a no-op"
   * is stated once. The outcome carries `changed`, and the effects respect it.
   */
  const announce = async (
    c: Context,
    outcome: ContentTranslationEditorialOutcome<TDefinition>,
  ): Promise<void> => {
    await contentTranslationEffects(c, definition, outcome, { pluginId });
  };

  /**
   * Turns a bare repository result into the outcome the effects expect.
   *
   * The path a localized content type **without** `editorial` takes: there is no
   * history to write, so there is no revision id - but the event still fires,
   * because `translation_created` is gated on localization and not on editorial.
   * With `editorial` the service produces a richer outcome itself and this is not
   * used.
   */
  const plainOutcome = (
    operation: ContentTranslationEditorialOutcome<TDefinition>["operation"],
    row: ContentTranslationRow<TDefinition>,
    {
      changed = true,
      changedFields = [],
    }: {
      changed?: boolean;
      changedFields?: ContentLocalizedFieldName<TDefinition>[];
    } = {},
  ): ContentTranslationEditorialOutcome<TDefinition> => ({
    changed,
    changedFields,
    languageId: row.languageId,
    locale: row.locale,
    operation,
    previousSlug: null,
    restoredFromRevisionId: null,
    revisionId: null,
    row,
    version: row.version,
  });

  const list = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.view },
    route: {
      method: "get",
      path: "/{id}/translations",
      description: `Which languages one ${label.singular} exists in`,
      request: { params: model.schemas.params },
      responses: {
        200: jsonResponse(
          z.object({ edges: z.array(translationSchemas.selectMeta) }),
          "One entry per existing translation, without its values",
        ),
        400: invalidIdentifier,
      },
    },
    handler: async c => {
      // Metadata only. A locale strip needs to know which languages exist and
      // how stale each one is; the detail route loads a body when a tab opens.
      const edges = await translations(c).findManyForItem(identifier(c));

      return c.json({ edges }, 200);
    },
  });

  const detail = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.view },
    route: {
      method: "get",
      path: "/{id}/translations/{locale}",
      description: `One ${label.singular} translation`,
      request: { params: translationSchemas.params },
      responses: {
        200: jsonResponse(translationSchemas.select, "Translation found"),
        400: invalidIdentifier,
        404: notFound,
      },
    },
    handler: async c => {
      const row = await translations(c).findByLocale(identifier(c), locale(c));
      if (!row) {
        throw new HTTPException(404, { message: "Translation not found." });
      }

      return c.json(row, 200);
    },
  });

  const create = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.translate },
    route: {
      method: "post",
      path: "/{id}/translations/{locale}",
      description: `Add a ${label.singular} translation`,
      request: {
        params: translationSchemas.params,
        body: jsonBody(translationSchemas.createEnvelope),
      },
      responses: {
        201: jsonResponse(translationSchemas.select, "Translation created"),
        400: { description: "Invalid input data" },
        404: notFound,
        409: conflict,
      },
    },
    handler: async c => {
      const id = identifier(c);
      const target = locale(c);
      const { values } = await readJson(c, translationSchemas.createEnvelope);

      // A new translation is always a draft. Publishing it is a separate,
      // separately permissioned step - a translator finishing a Polish copy must
      // not put it on the internet by pressing save.
      const outcome = await withTranslationHttpErrors(
        "create",
        async () =>
          buildEditorial
            ? await editorial(c).create(id, target, values, {
                actor: resolveContentActor(c),
              })
            : plainOutcome(
                "create",
                await translations(c).create(id, target, values),
              ),
        { contentTypeId: definition.id, itemId: id, locale: target },
      );

      await announce(c, outcome);

      return c.json(outcome.row, 201);
    },
  });

  const update = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.translate },
    route: {
      // PUT, not PATCH: the Next.js API route handler exports no PATCH.
      method: "put",
      path: "/{id}/translations/{locale}",
      description: `Update a ${label.singular} translation`,
      request: {
        params: translationSchemas.params,
        body: jsonBody(translationSchemas.updateEnvelope),
      },
      responses: {
        200: jsonResponse(
          z.object({
            /** `false` when nothing moved - the version is unchanged. */
            changed: z.boolean(),
            row: translationSchemas.select,
          }),
          "Translation updated, or already at those values",
        ),
        400: { description: "Invalid or empty payload" },
        404: notFound,
        409: conflict,
      },
    },
    handler: async c => {
      const id = identifier(c);
      const target = locale(c);
      const { expectedVersion, values } = await readJson(
        c,
        translationSchemas.updateEnvelope,
      );

      const outcome = await withTranslationHttpErrors(
        "update",
        async () =>
          buildEditorial
            ? await editorial(c).update(id, target, values, {
                actor: resolveContentActor(c),
                expectedVersion,
              })
            : await (async () => {
                const result = await translations(c).update(
                  id,
                  target,
                  values,
                  { expectedVersion },
                );

                return result
                  ? plainOutcome("update", result.row, {
                      changed: result.changed,
                      changedFields: result.changedFields,
                    })
                  : null;
              })(),
        { contentTypeId: definition.id, itemId: id, locale: target },
      );
      if (!outcome) {
        throw new HTTPException(404, { message: "Translation not found." });
      }

      await announce(c, outcome);

      return c.json({ changed: outcome.changed, row: outcome.row }, 200);
    },
  });

  /**
   * The default-locale translation is not deletable, which is why this route
   * declares a 409 rather than treating it as a 400: the request is well formed,
   * and the reason it is refused is a state the client can read off the content
   * type and act on.
   *
   * The body carries `expectedVersion` for the same reason the editorial delete
   * does: a delete is the widest possible overwrite, and a confirmation dialog
   * cannot ask about a change the person has not seen.
   */
  const remove = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.delete },
    route: {
      method: "delete",
      path: "/{id}/translations/{locale}",
      description: `Delete a ${label.singular} translation`,
      request: {
        params: translationSchemas.params,
        body: jsonBody(translationSchemas.versionEnvelope),
      },
      responses: {
        200: jsonResponse(translationSchemas.select, "Translation deleted"),
        400: invalidIdentifier,
        404: notFound,
        409: conflict,
      },
    },
    handler: async c => {
      const id = identifier(c);
      const target = locale(c);
      const { expectedVersion } = await readJson(
        c,
        translationSchemas.versionEnvelope,
      );

      const outcome = await withTranslationHttpErrors(
        "delete",
        async () =>
          buildEditorial
            ? await editorial(c).delete(id, target, {
                actor: resolveContentActor(c),
                expectedVersion,
              })
            : await (async () => {
                const row = await translations(c).delete(id, target, {
                  expectedVersion,
                });

                return row ? plainOutcome("delete", row) : null;
              })(),
        { contentTypeId: definition.id, itemId: id, locale: target },
      );
      if (!outcome) {
        throw new HTTPException(404, { message: "Translation not found." });
      }

      await announce(c, outcome);

      return c.json(outcome.row, 200);
    },
  });

  // -------------------------------------------------------------------------
  // Lifecycle: only with `publication`, which is what a translation status is
  // subordinate to. Without it the columns do not exist and there is nothing to
  // move.
  // -------------------------------------------------------------------------

  const transitionRoute = (action: "publish" | "unpublish") =>
    buildRoute({
      pluginId,
      adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.publish },
      route: {
        method: "post",
        path: `/{id}/translations/{locale}/${action}`,
        description: `${action === "publish" ? "Publish" : "Unpublish"} one ${label.singular} translation`,
        request: {
          params: translationSchemas.params,
          body: jsonBody(translationSchemas.versionEnvelope),
        },
        responses: {
          200: jsonResponse(
            z.object({
              /** `false` when it was already in that state - a true no-op. */
              changed: z.boolean(),
              row: translationSchemas.select,
            }),
            `Translation ${action}ed, or already ${action}ed`,
          ),
          400: invalidIdentifier,
          404: notFound,
          409: conflict,
        },
      },
      handler: async c => {
        const id = identifier(c);
        const target = locale(c);
        const { expectedVersion } = await readJson(
          c,
          translationSchemas.versionEnvelope,
        );

        const outcome = await withTranslationHttpErrors(
          "update",
          async () =>
            await editorial(c)[action](id, target, {
              actor: resolveContentActor(c),
              expectedVersion,
            }),
          { contentTypeId: definition.id, itemId: id, locale: target },
        );
        if (!outcome) {
          throw new HTTPException(404, { message: "Translation not found." });
        }

        await announce(c, outcome);

        return c.json({ changed: outcome.changed, row: outcome.row }, 200);
      },
    });

  // -------------------------------------------------------------------------
  // History: only with `editorial`.
  // -------------------------------------------------------------------------

  const zodTranslationRevisionMeta = z.object({
    actorName: z.string().nullable(),
    actorType: z.enum(CONTENT_ACTOR_TYPES),
    actorUserId: z.number().nullable(),
    changedFields: z.array(z.string()),
    createdAt: z.union([z.date(), z.string()]),
    id: z.number(),
    operation: z.enum(CONTENT_TRANSLATION_REVISION_OPERATIONS),
    restoredFromRevisionId: z.number().nullable(),
    version: z.number(),
  });

  // `.loose()` for the same reason the shared revision detail is loose: a snapshot
  // is data this content type wrote, and its shape moves with the content type.
  const zodTranslationRevisionDetail = zodTranslationRevisionMeta.extend({
    locale: z.string(),
    snapshot: z.object({}).loose(),
  });

  const revisionParams = z.object({
    id: z.coerce.number(),
    locale: z.string().min(1).max(CONTENT_LOCALE_MAX_LENGTH),
    revisionId: z.coerce.number(),
  });

  const revisionIdentifier = (c: Context): number => {
    const value = Number(c.req.param("revisionId"));
    if (!Number.isInteger(value) || value <= 0) {
      throw new HTTPException(400, { message: "Invalid revision identifier." });
    }

    return value;
  };

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
      path: "/{id}/translations/{locale}/revisions",
      description: `History of one ${label.singular} translation`,
      request: { params: translationSchemas.params, query: revisionQuery },
      responses: {
        200: jsonResponse(
          z.object({
            edges: z.array(zodTranslationRevisionMeta),
            pageInfo: z.object({
              endCursor: z.number().nullable(),
              hasNextPage: z.boolean(),
            }),
          }),
          "Revisions of this locale, newest first",
        ),
        400: invalidIdentifier,
        404: notFound,
      },
    },
    handler: async c => {
      const { cursor, first } = revisionQuery.parse(c.req.query());

      // Scoped to the locale in the URL, so the English history is unreachable
      // from the Polish tab - the model filters on `languageId`, it is not a
      // post-filter over a wider read.
      const page = await withTranslationHttpErrors(
        "read",
        async () =>
          await editorial(c).listRevisions(identifier(c), locale(c), {
            cursor,
            limit: first,
          }),
        { contentTypeId: definition.id },
      );

      return c.json(page, 200);
    },
  });

  const revisionDetail = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.view },
    route: {
      method: "get",
      path: "/{id}/translations/{locale}/revisions/{revisionId}",
      description: `One revision of a ${label.singular} translation`,
      request: { params: revisionParams },
      responses: {
        200: jsonResponse(zodTranslationRevisionDetail, "Revision found"),
        400: invalidIdentifier,
        404: { description: "Revision not found" },
      },
    },
    handler: async c => {
      const revision = await withTranslationHttpErrors(
        "read",
        async () =>
          await editorial(c).findRevision(
            identifier(c),
            locale(c),
            revisionIdentifier(c),
          ),
        { contentTypeId: definition.id },
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
      path: "/{id}/translations/{locale}/revisions/{revisionId}/restore",
      description: `Restore one ${label.singular} translation to an earlier revision`,
      request: {
        params: revisionParams,
        body: jsonBody(translationSchemas.versionEnvelope),
      },
      responses: {
        200: jsonResponse(
          z.object({
            changed: z.boolean(),
            row: translationSchemas.select,
          }),
          "Translation restored, or already at those values",
        ),
        400: invalidIdentifier,
        404: { description: "Revision not found" },
        409: conflict,
        422: jsonResponse(
          zodContentUnprocessable,
          "The revision no longer fits this content type",
        ),
      },
    },
    handler: async c => {
      const id = identifier(c);
      const target = locale(c);
      const revisionId = revisionIdentifier(c);
      const { expectedVersion } = await readJson(
        c,
        translationSchemas.versionEnvelope,
      );

      const outcome = await withTranslationHttpErrors(
        "update",
        async () =>
          await editorial(c).restore(id, target, revisionId, {
            actor: resolveContentActor(c),
            expectedVersion,
          }),
        { contentTypeId: definition.id, itemId: id, locale: target },
      );
      if (!outcome) {
        throw new HTTPException(404, { message: "Revision not found." });
      }

      await announce(c, outcome);

      return c.json({ changed: outcome.changed, row: outcome.row }, 200);
    },
  });

  /**
   * Mints a preview link for one language.
   *
   * The localized counterpart of `POST /{id}/preview`, and it freezes **both**
   * halves of the page: the record's newest shared revision and this locale's
   * newest translation revision. A preview says "this is what the page looked
   * like when I shared the link", and a localized page is built from two rows -
   * freezing one of them would let the other drift underneath the reviewer.
   *
   * `can_view`, exactly like the base preview route: a preview shows what the
   * public route would show, so anyone allowed to read the record in the AdminCP
   * is already allowed to see it. The link is the credential from there on, and it
   * is bound to this locale - opening it on another language's URL is a 404.
   *
   * A locale with no translation is a 404 rather than a link to the fallback: the
   * button is on a language tab, and a link that quietly previewed a different
   * language would be worse than no link.
   */
  const previewToken = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.view },
    route: {
      method: "post",
      path: "/{id}/translations/{locale}/preview",
      description: `Create a preview link for one ${label.singular} in one language`,
      request: { params: translationSchemas.params },
      responses: {
        200: jsonResponse(
          z.object({
            expiresAt: z.date(),
            locale: z.string(),
            /** `0` when the record predates its content type opting in. */
            revisionId: z.number(),
            token: z.string(),
            /** `0` when this locale has no translation revision to freeze. */
            translationRevisionId: z.number(),
            /** Absolute, and carrying `?locale=` so the reader stays bound. */
            url: z.url(),
            version: z.number(),
          }),
          "Preview link created",
        ),
        400: invalidIdentifier,
        404: notFound,
        503: {
          description:
            "Preview is not configured securely on this deployment, so no link can be signed",
        },
      },
    },
    handler: async c => {
      // Before the lookup, so a misconfigured install answers the same way for a
      // record that exists and one that does not.
      assertContentPreviewIsServable(c);

      const id = identifier(c);
      const target = locale(c);

      const translation = await withTranslationHttpErrors(
        "read",
        async () => await translations(c).findByLocale(id, target),
        { contentTypeId: definition.id, itemId: id, locale: target },
      );
      if (!translation) {
        throw new HTTPException(404, { message: "Translation not found." });
      }

      const shared = model.editorialService?.(c, { pluginId });
      const sharedRevision = shared ? await shared.revisions.latest(id) : null;

      // Newest first, so one row is the whole answer. The newest is also the
      // last one retention will prune, so a shared link stays resolvable for as
      // long as any link would.
      const history = buildEditorial
        ? await editorial(c).listRevisions(id, translation.locale, { limit: 1 })
        : { edges: [] };
      const translationRevisionId = history.edges[0]?.id ?? 0;

      const { expiresAt, token } = createContentPreviewToken({
        definition,
        itemId: id,
        languageId: translation.languageId,
        locale: translation.locale,
        pluginId,
        revisionId: sharedRevision?.id ?? 0,
        secret: contentPreviewSecret(c),
        translationRevisionId,
        version: translation.version,
      });

      return c.json(
        {
          expiresAt,
          locale: translation.locale,
          revisionId: sharedRevision?.id ?? 0,
          token,
          translationRevisionId,
          url: contentPreviewUrl({
            definition,
            locale: translation.locale,
            pluginId,
            token,
          }),
          version: translation.version,
        },
        200,
      );
    },
  });

  /**
   * Which languages this record is publicly reachable in, and under which URL.
   *
   * Exists for the cache, and only incidentally for the screen. A Server Action
   * runs in the web app and talks to the API over HTTP, so it cannot evaluate the
   * fallback rule itself - and a second implementation of "is this locale public"
   * living in the AdminCP is exactly the copy that drifts, with a stale page in
   * one language as the symptom. It takes this snapshot on each side of a
   * mutation and expires the difference.
   *
   * `can_view`, because it says no more than the public API already does - which
   * languages have a page, and what its slug is.
   */
  const publicLocales = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.view },
    route: {
      method: "get",
      path: "/{id}/public-locales",
      description: `Which languages one ${label.singular} is publicly reachable in`,
      request: { params: model.schemas.params },
      responses: {
        200: jsonResponse(
          z.object({
            edges: z.array(
              z.object({
                /** `false` when the fallback is what makes this locale public. */
                hasOwnTranslation: z.boolean(),
                isPublic: z.boolean(),
                locale: z.string(),
                slug: z.string(),
              }),
            ),
          }),
          "One entry per enabled language",
        ),
        400: invalidIdentifier,
      },
    },
    handler: async c =>
      c.json(
        { edges: await contentPublicLocaleStates(c, model, identifier(c)) },
        200,
      ),
  });

  const publication = definition.publication.enabled;
  const editorialEnabled = definition.editorial.enabled;

  return [
    list,
    detail,
    create,
    update,
    remove,
    ...(publication && editorialEnabled
      ? [transitionRoute("publish"), transitionRoute("unpublish")]
      : []),
    ...(editorialEnabled ? [revisionList, revisionDetail, restore] : []),
    // `editorial.preview` already requires `publicApi`, so this exists only for a
    // localized content type that has a public API to preview against.
    ...(definition.editorial.preview.enabled ? [previewToken] : []),
    ...(definition.publicApi.enabled ? [publicLocales] : []),
  ];
};

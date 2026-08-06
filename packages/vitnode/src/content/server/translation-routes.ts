import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import type { AnyContentTypeDefinition } from "../types";
import type { ContentModel } from "./model";
import type { ContentTranslationModel } from "./translation-model";

import { buildRoute } from "../../api/lib/route";
import { zodContentTranslationConflict } from "../conflicts";
import { CONTENT_LOCALE_MAX_LENGTH, CONTENT_PERMISSIONS } from "../const";
import { withTranslationHttpErrors } from "./translation-http-errors";

/**
 * The five generated translation routes for one localized content type.
 *
 * Identity is `(content type, item, locale)` and never the translation row's own
 * key: `(itemId, languageId)` is the primary key, there is no surrogate id to
 * leak, and a locale in the URL cannot be used to reach another content type's
 * translation because the module the route is mounted in already fixes which
 * table is being read.
 *
 * Permissions reuse the ones the content type already has - `can_view` to read,
 * `can_edit` to write, `can_delete` to remove. A dedicated `can_translate` is
 * Stage 5B work: adding a permission means a migration for every existing role,
 * and doing that before the AdminCP has a translation screen to gate would ship a
 * checkbox that governs nothing anybody can see.
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

  const translations = (c: Context): ContentTranslationModel<TDefinition> =>
    buildService(c);

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
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.edit },
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

      const row = await withTranslationHttpErrors(
        "create",
        async () => await translations(c).create(id, target, values),
        { contentTypeId: definition.id, itemId: id, locale: target },
      );

      return c.json(row, 201);
    },
  });

  const update = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.edit },
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

      const result = await withTranslationHttpErrors(
        "update",
        async () =>
          await translations(c).update(id, target, values, {
            expectedVersion,
          }),
        { contentTypeId: definition.id, itemId: id, locale: target },
      );
      if (!result) {
        throw new HTTPException(404, { message: "Translation not found." });
      }

      return c.json({ changed: result.changed, row: result.row }, 200);
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

      const row = await withTranslationHttpErrors(
        "delete",
        async () =>
          await translations(c).delete(id, target, { expectedVersion }),
        { contentTypeId: definition.id, itemId: id, locale: target },
      );
      if (!row) {
        throw new HTTPException(404, { message: "Translation not found." });
      }

      return c.json(row, 200);
    },
  });

  return [list, detail, create, update, remove];
};

import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import type {
  AnyContentTypeDefinition,
  ContentCreateInput,
  ContentLocalizedUpdateValues,
  ContentLocalizedValues,
  ContentSelect,
  ContentUpdateInput,
} from "../types";
import type { ContentEditorialOutcome } from "./editorial-service";
import type { ContentModel } from "./model";
import type { ContentDatabase } from "./service";
import type { ContentTranslationEditorialOutcome } from "./translation-editorial-service";

import { buildRoute } from "../../api/lib/route";
import {
  zodContentConflict,
  zodContentDeliveryConflict,
  zodContentTranslationConflict,
} from "../conflicts";
import { CONTENT_LOCALE_MAX_LENGTH, CONTENT_PERMISSIONS } from "../const";
import { resolveContentActor } from "./actor";
import { contentEditorialEffects } from "./editorial-effects";
import { emitContentEvent } from "./emit";
import { withHttpErrors } from "./http-errors";
import { contentSearchAdvancedValues, syncContentSearch } from "./search-sync";
import { contentTranslationEffects } from "./translation-effects";
import { withTranslationHttpErrors } from "./translation-http-errors";

/** One language's half of a submitted form, after validation. */
interface TranslationEntry {
  expectedVersion?: number;
  locale: string;
  values: Record<string, unknown>;
}

/**
 * The two **composite** admin routes of a localized content type.
 *
 * One AdminCP form now edits a record and every language it exists in, because
 * that is how the screen is laid out: each localized input carries its own small
 * language switcher, and there is exactly one Save button. Saving touches the
 * base row and any number of translation rows, and the only honest way to do
 * that is inside one transaction - otherwise a Polish version conflict would
 * leave the shared fields and the English copy already written while the button
 * reported a failure.
 *
 * Nothing about the localization *model* changes here. These routes are a caller
 * of the same transaction-aware services the per-locale routes use: the base row
 * keeps its own version, every translation keeps its own, every mutation writes
 * its own revision, and every event still comes out of the same effects. What is
 * new is the boundary drawn around them.
 *
 * The per-locale routes stay exactly where they were, gated on `can_edit`, and
 * the AdminCP still uses them for per-language publication and history.
 */
export const buildContentLocalizedAdminRoutes = <
  TDefinition extends AnyContentTypeDefinition,
  P extends string,
>(
  model: ContentModel<TDefinition>,
  { pluginId }: { pluginId: P },
) => {
  const { definition, schemas } = model;
  const translationSchemas = model.translationSchemas;
  const buildTranslations = model.translationService;

  if (!translationSchemas || !buildTranslations) {
    throw new Error(
      `[Content Engine] ${definition.id}: buildContentLocalizedAdminRoutes needs a localized content type.`,
    );
  }

  const module = definition.permissionModule;
  const label = definition.admin.label;
  const editorial = definition.editorial.enabled;
  const { defaultLocale } = definition.localization;

  const jsonBody = (schema: z.ZodType) => ({
    content: { "application/json": { schema } },
  });
  const jsonResponse = (schema: z.ZodType, description: string) => ({
    content: { "application/json": { schema } },
    description,
  });

  // Every arm a composite save can be refused with, in one union: the base row's
  // (version, unique), the translations' (version, exists, disabled language,
  // localized unique) and delivery's reserved address. A client has to be able to
  // tell which half of the form to point at, and in which language.
  const conflict = jsonResponse(
    z.union([
      zodContentConflict,
      zodContentTranslationConflict,
      zodContentDeliveryConflict,
    ]),
    "The record moved, a translation moved, or a value is taken",
  );

  /**
   * One language's half of the form.
   *
   * `values` is the **partial** localized shape rather than the create shape,
   * because the same entry describes both "create this translation" and "these
   * two fields of it changed". Which one it is follows from `expectedVersion`,
   * and a create is re-parsed through the strict create schema - so a translation
   * still cannot come into being without its required fields, whichever route
   * brought it here.
   */
  const translationEntry = z.object({
    /**
     * The version the editor loaded, on a translation that already exists.
     *
     * Absent means "this language had no translation when I opened the form".
     * Getting that wrong is a 409 rather than a silent overwrite: the row is
     * there, and somebody created it after the form was opened.
     */
    expectedVersion: z.number().int().positive().optional(),
    locale: z.string().min(1).max(CONTENT_LOCALE_MAX_LENGTH),
    values: translationSchemas.createObject.partial(),
  });

  const createBody = z.object({
    /** One entry per language the editor actually typed into. */
    translations: z.array(translationEntry),
    values: schemas.create,
  });

  const updateBody = z.object({
    /** The base row's version. Required to change a shared field. */
    expectedVersion: z.number().int().positive().optional(),
    translations: z.array(translationEntry),
    /**
     * Absent when no shared field changed, and that absence is the whole no-op
     * story: a Polish-only edit must not bump the base version, write a base
     * revision, or expire the English cache.
     */
    values: (
      schemas.update as z.ZodType<ContentUpdateInput<TDefinition>>
    ).optional(),
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

  const sameLocale = (left: string, right: string): boolean =>
    left.toLowerCase() === right.toLowerCase();

  /** Mirrors `translation-routes`: a repository result, shaped for the effects. */
  const plainOutcome = (
    operation: ContentTranslationEditorialOutcome<TDefinition>["operation"],
    row: ContentTranslationEditorialOutcome<TDefinition>["row"],
    {
      changed = true,
      changedFields = [],
    }: {
      changed?: boolean;
      changedFields?: ContentTranslationEditorialOutcome<TDefinition>["changedFields"];
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

  /**
   * Writes one language inside the caller's transaction.
   *
   * The whole of the per-locale write path, reached exactly as the single-locale
   * route reaches it: editorial when the content type has history, the plain
   * repository when it does not. The outcome comes back so its effects can fire
   * *after* the commit and never inside it.
   */
  const writeTranslation = async (
    c: Context,
    itemId: number,
    entry: TranslationEntry,
    tx: ContentDatabase,
  ): Promise<ContentTranslationEditorialOutcome<TDefinition> | null> => {
    const buildEditorial = model.translationEditorialService;
    const translations = buildTranslations(c);

    return await withTranslationHttpErrors(
      entry.expectedVersion === undefined ? "create" : "update",
      async () => {
        if (entry.expectedVersion === undefined) {
          const complete = translationSchemas.createObject.parse(
            entry.values,
          ) as ContentLocalizedValues<TDefinition>;

          if (buildEditorial) {
            return await buildEditorial(c, { pluginId }).create(
              itemId,
              entry.locale,
              complete,
              { actor: resolveContentActor(c), tx },
            );
          }

          return plainOutcome(
            "create",
            await translations.create(itemId, entry.locale, complete, { tx }),
          );
        }

        const patch = entry.values as ContentLocalizedUpdateValues<TDefinition>;

        if (buildEditorial) {
          return await buildEditorial(c, { pluginId }).update(
            itemId,
            entry.locale,
            patch,
            {
              actor: resolveContentActor(c),
              expectedVersion: entry.expectedVersion,
              tx,
            },
          );
        }

        const result = await translations.update(itemId, entry.locale, patch, {
          expectedVersion: entry.expectedVersion,
          tx,
        });

        return result
          ? plainOutcome("update", result.row, {
              changed: result.changed,
              changedFields: result.changedFields,
            })
          : null;
      },
      { contentTypeId: definition.id, itemId, locale: entry.locale },
    );
  };

  /**
   * The shared half of a composite write, through whichever service owns it.
   *
   * An editorial content type writes a revision and enforces the version; a plain
   * one does neither, because it has neither. Either way this is the same call
   * the single-record route makes - inside the caller's transaction.
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

  /**
   * The effects one shared write owes, once its transaction has committed.
   *
   * `contentEditorialEffects` for an editorial content type - the same call the
   * single-record routes make, so which event and which search operation an
   * outcome deserves stays stated in exactly one place - and the plain
   * event/index pair for one without.
   */
  const announceShared = async (
    c: Context,
    outcome: ContentEditorialOutcome<TDefinition> | null,
    row: ContentSelect<TDefinition>,
    operation: "create" | "update",
    changedFields: readonly string[],
  ): Promise<void> => {
    if (outcome) {
      await contentEditorialEffects(c, definition, outcome, {
        model,
        pluginId,
      });

      return;
    }

    const id = (row as { id: number }).id;

    await emitContentEvent(
      c,
      definition,
      operation === "create" ? "created" : "updated",
      operation === "create"
        ? { contentId: id }
        : { changedFields: [...changedFields], contentId: id },
      { pluginId },
    );
    await syncContentSearch(c, definition, {
      advanced: await contentSearchAdvancedValues(c, model, id),
      changedFields: [...changedFields],
      operation,
      pluginId,
      row,
    });
  };

  const create = buildRoute({
    pluginId,
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.create },
    route: {
      method: "post",
      path: "/localized",
      description: `Create a ${label.singular} with its translations`,
      request: { body: jsonBody(createBody) },
      responses: {
        201: jsonResponse(
          schemas.selectObject,
          `${label.singular} created successfully`,
        ),
        400: { description: "Invalid input data" },
        409: conflict,
      },
    },
    handler: async c => {
      const body = await readJson(c, createBody);
      const entries = body.translations as TranslationEntry[];

      if (!entries.some(entry => sameLocale(entry.locale, defaultLocale))) {
        // The one invariant a create cannot bend: a record exists in at least
        // its default language or it does not exist. Refused here rather than
        // left to a foreign key, so the message names the language instead of
        // quoting a constraint.
        throw new HTTPException(400, {
          message: `A ${label.singular} is created in its default language "${defaultLocale}". Fill in its required fields in that language.`,
        });
      }

      // The default translation first, so the record is never momentarily one
      // without it - even inside the transaction that would be a state the
      // triggers and the slug reservations could observe.
      const ordered = [...entries].sort((left, right) =>
        sameLocale(left.locale, defaultLocale)
          ? -1
          : sameLocale(right.locale, defaultLocale)
            ? 1
            : 0,
      );

      const result = await withHttpErrors(
        "create",
        async () =>
          await c.get("db").transaction(async tx => {
            const outcome = editorial
              ? await editorialService(c).create(body.values, {
                  actor: resolveContentActor(c),
                  tx,
                })
              : null;
            const row =
              outcome?.row ??
              (await model.service(c).create(body.values, { tx }));

            const written: ContentTranslationEditorialOutcome<TDefinition>[] =
              [];
            for (const entry of ordered) {
              const translated = await writeTranslation(
                c,
                (row as { id: number }).id,
                entry,
                tx,
              );
              if (translated) written.push(translated);
            }

            return { outcome, row, written };
          }),
        { contentTypeId: definition.id, structured: editorial },
      );

      // Everything below runs after the commit. An event emitted inside a
      // transaction that later rolls back is a claim the rest of the system
      // cannot take back.
      await announceShared(c, result.outcome, result.row, "create", []);
      for (const written of result.written) {
        await contentTranslationEffects(c, definition, written, {
          model,
          pluginId,
        });
      }

      return c.json(result.row, 201);
    },
  });

  const update = buildRoute({
    pluginId,
    // `can_edit`, for the shared half and every language alike: one Save button
    // writes one record, and there is no second permission for the part of it
    // that happens to live on the translation table.
    adminStaffPermission: { module, permission: CONTENT_PERMISSIONS.edit },
    route: {
      method: "put",
      path: "/{id}/localized",
      description: `Update a ${label.singular} and its translations`,
      request: { params: schemas.params, body: jsonBody(updateBody) },
      responses: {
        200: jsonResponse(
          schemas.selectObject,
          `${label.singular} updated successfully`,
        ),
        400: { description: "Invalid or empty payload" },
        404: { description: `${label.singular} not found` },
        409: conflict,
      },
    },
    handler: async c => {
      const id = identifier(c);
      const body = await readJson(c, updateBody);
      const entries = body.translations as TranslationEntry[];
      const shared = body.values;

      if (
        editorial &&
        shared !== undefined &&
        body.expectedVersion === undefined
      ) {
        throw new HTTPException(400, {
          message: "expectedVersion is required to change a shared field.",
        });
      }

      const result = await withHttpErrors(
        "update",
        async () =>
          await c.get("db").transaction(async tx => {
            // Shared first, so a base version conflict costs nothing: the
            // translations are never written and the transaction ends here.
            let outcome: ContentEditorialOutcome<TDefinition> | null = null;
            let changedFields: readonly string[] = [];
            let row: ContentSelect<TDefinition> | null = null;

            if (shared !== undefined) {
              if (editorial) {
                outcome = await editorialService(c).update(id, shared, {
                  actor: resolveContentActor(c),
                  expectedVersion: body.expectedVersion ?? 0,
                  tx,
                });
                if (!outcome) return null;
                changedFields = outcome.changedFields;
                row = outcome.row;
              } else {
                const plain = await model.service(c).update(id, shared, { tx });
                if (!plain) return null;
                changedFields = plain.changedFields;
                row = plain.row;
              }
            }

            const written: ContentTranslationEditorialOutcome<TDefinition>[] =
              [];
            for (const entry of entries) {
              const translated = await writeTranslation(c, id, entry, tx);
              if (translated) written.push(translated);
            }

            const current =
              row ?? (await model.service(c).findById(id, { tx }));

            return current === null
              ? null
              : {
                  changedFields,
                  outcome,
                  row: current,
                  touched: row !== null,
                  written,
                };
          }),
        { contentTypeId: definition.id, itemId: id, structured: editorial },
      );

      if (!result) {
        throw new HTTPException(404, {
          message: `${label.singular} not found.`,
        });
      }

      if (result.touched) {
        await announceShared(
          c,
          result.outcome,
          result.row,
          "update",
          result.changedFields,
        );
      }
      for (const written of result.written) {
        await contentTranslationEffects(c, definition, written, {
          model,
          pluginId,
        });
      }

      return c.json(result.row, 200);
    },
  });

  return [create, update];
};

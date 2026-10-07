import type { z } from "@hono/zod-openapi";
import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";

import type { ContentIdOf, ContentIdStrategy } from "../ids";
import type {
  ContentLocalizedFieldName,
  ContentTranslationRow,
} from "../types";
import type { ContentTranslationEditorialOutcome } from "./translation-editorial-service";

import { CONTENT_SERIAL_MAX, parseContentId } from "../ids";

/**
 * The positive `{id}` in the path, or a 400 before any handler runs. Read the
 * way `Number` reads it, as a `serial` route always has - and capped at the
 * largest `integer`, so an id Postgres could never hold is a 400 rather than an
 * out-of-range error from the driver.
 */
export const identifier = (c: Context, param = "id"): number => {
  const value = Number(c.req.param(param));
  if (!Number.isInteger(value) || value <= 0 || value > CONTENT_SERIAL_MAX) {
    throw new HTTPException(400, { message: "Invalid identifier." });
  }

  return value;
};

/**
 * {@link identifier} for one content type, under its id strategy. A `serial`
 * content type reads exactly as before; a `uuid` or `bigint` one accepts only
 * the canonical spelling - lowercase hyphenated hex, or decimal digits within
 * range - so a malformed id is a 400 here and never a Postgres cast error.
 */
export const contentIdentifier = <
  TDefinition extends { idStrategy: ContentIdStrategy },
>(
  c: Context,
  definition: TDefinition,
  param = "id",
): ContentIdOf<TDefinition> => {
  if (definition.idStrategy === "serial") {
    return identifier(c, param) as ContentIdOf<TDefinition>;
  }

  const value = parseContentId(definition.idStrategy, c.req.param(param));
  if (value === null) {
    throw new HTTPException(400, { message: "Invalid identifier." });
  }

  return value as ContentIdOf<TDefinition>;
};

/**
 * The validated payload, re-read through the very schema that produced it.
 *
 * `c.req.valid()` cannot infer through a generic route config, which is what
 * every Content Engine route is. This keeps the handlers cast-free and
 * correctly typed.
 */
export const readJson = async <TValue>(
  c: Context,
  schema: z.ZodType<TValue>,
): Promise<TValue> => schema.parse(await c.req.json());

/**
 * {@link readJson} for a body the client may leave out entirely - `POST
 * /{id}/hide` with nothing to say is the same as `{}`. A body that *is* sent is
 * validated exactly as strictly as any other.
 */
export const readOptionalJson = async <TValue>(
  c: Context,
  schema: z.ZodType<TValue>,
): Promise<TValue> => {
  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.toLowerCase().includes("json")) return schema.parse({});

  const text = await c.req.text();

  return schema.parse(text.trim() === "" ? {} : JSON.parse(text));
};

export const jsonBody = (schema: z.ZodType) => ({
  content: { "application/json": { schema } },
});

export const jsonResponse = (schema: z.ZodType, description: string) => ({
  content: { "application/json": { schema } },
  description,
});

/**
 * Turns a bare repository result into the outcome the effects expect.
 *
 * The path a localized content type **without** `editorial` takes, for every
 * mutation including publish and unpublish: there is no history to write, so
 * there is no revision id - but the event still fires, because
 * `translation_published` and friends are gated on localization and
 * publication, not on editorial. With `editorial` the service produces a
 * richer outcome itself and this is not used.
 */
export const plainOutcome = <TDefinition>(
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

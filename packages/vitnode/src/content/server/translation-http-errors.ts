import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";

import type { ContentTranslationConflict } from "../conflicts";

import { CONTENT_TRANSLATION_CONFLICT_CODES } from "../const";
import {
  ContentDefaultTranslationRequired,
  ContentInputError,
  ContentLanguageError,
  ContentTranslationExists,
  ContentTranslationItemMissing,
  ContentTranslationVersionConflict,
} from "../errors";
import { rethrowAsHttpError } from "./http-errors";

/** A structured 409, in the translation union. */
export const contentTranslationConflict = (
  body: ContentTranslationConflict,
): HTTPException =>
  new HTTPException(409, { res: Response.json(body, { status: 409 }) });

/**
 * Maps a translation write's failures onto HTTP.
 *
 * The five outcomes it separates are the whole point - a client that cannot tell
 * them apart can only show "something went wrong":
 *
 * | Failure                        | Status | Code                                   |
 * | ------------------------------ | ------ | -------------------------------------- |
 * | base record missing            | 404    | -                                      |
 * | locale unknown                 | 404    | -                                      |
 * | locale disabled                | 409    | `CONTENT_LANGUAGE_DISABLED`            |
 * | translation already exists     | 409    | `CONTENT_TRANSLATION_EXISTS`           |
 * | version moved                  | 409    | `CONTENT_TRANSLATION_VERSION_CONFLICT` |
 * | default translation delete     | 409    | `CONTENT_DEFAULT_TRANSLATION_REQUIRED` |
 * | localized slug taken           | 409    | `CONTENT_TRANSLATION_UNIQUE_CONFLICT`  |
 *
 * Anything it does not recognise falls through to {@link rethrowAsHttpError},
 * which owns the Postgres constraint codes - so the driver's message, which can
 * name columns, constraints and values, never reaches a client from here either.
 */
export const withTranslationHttpErrors = async <TResult>(
  action: "create" | "delete" | "update",
  run: () => Promise<TResult>,
  {
    contentTypeId,
    itemId,
    locale,
  }: { contentTypeId: string; itemId: number; locale: string },
): Promise<TResult> => {
  try {
    return await run();
  } catch (error) {
    if (error instanceof HTTPException) throw error;

    if (error instanceof ContentTranslationVersionConflict) {
      throw contentTranslationConflict({
        code: CONTENT_TRANSLATION_CONFLICT_CODES.version,
        contentTypeId,
        currentVersion: error.currentVersion,
        expectedVersion: error.expectedVersion,
        itemId: error.itemId,
        locale: error.locale,
      });
    }

    if (error instanceof ContentDefaultTranslationRequired) {
      throw contentTranslationConflict({
        code: CONTENT_TRANSLATION_CONFLICT_CODES.defaultRequired,
        contentTypeId,
        itemId: error.itemId,
        locale: error.locale,
      });
    }

    if (error instanceof ContentTranslationExists) {
      throw contentTranslationConflict({
        code: CONTENT_TRANSLATION_CONFLICT_CODES.exists,
        contentTypeId,
        itemId: error.itemId,
        locale: error.locale,
      });
    }

    if (error instanceof ContentLanguageError) {
      // Missing is a 404 and disabled is a 409: one is "no such thing to
      // address", the other is "it exists and this install has switched it off",
      // and only the second is something an admin can undo.
      if (error.reason === "missing") {
        throw new HTTPException(404, { message: error.message });
      }

      throw contentTranslationConflict({
        code: CONTENT_TRANSLATION_CONFLICT_CODES.languageDisabled,
        contentTypeId,
        locale: error.locale,
      });
    }

    if (error instanceof ContentTranslationItemMissing) {
      throw new HTTPException(404, { message: error.message });
    }

    // Written for the client on purpose, like the base service's: "send the slug
    // explicitly" is useless if it never leaves the server.
    if (error instanceof ContentInputError) {
      throw new HTTPException(400, { message: error.message });
    }

    if (error instanceof ZodError) {
      throw new HTTPException(400, { message: "Invalid input data." });
    }

    try {
      return rethrowAsHttpError(error, { action, contentTypeId, itemId });
    } catch (mapped) {
      // A localized unique clash is a slug that is taken *in this language*, so
      // it answers in the translation union with the locale attached rather than
      // with the base 409 the shared mapper produces.
      if (mapped instanceof HTTPException && mapped.status === 409) {
        throw contentTranslationConflict({
          code: CONTENT_TRANSLATION_CONFLICT_CODES.unique,
          contentTypeId,
          itemId,
          locale,
        });
      }

      throw mapped;
    }
  }
};

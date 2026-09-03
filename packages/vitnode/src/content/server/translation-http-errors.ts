import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";

import type { ContentTranslationConflict } from "../conflicts";

import {
  CONTENT_DELIVERY_CODES,
  CONTENT_TRANSLATION_CONFLICT_CODES,
  CONTENT_UNPROCESSABLE_CODES,
} from "../const";
import {
  ContentDefaultTranslationRequired,
  ContentDeliverySlugReserved,
  ContentInputError,
  ContentLanguageError,
  ContentRevisionNotRestorable,
  ContentTranslationExists,
  ContentTranslationItemMissing,
  ContentTranslationVersionConflict,
} from "../errors";
import { ContentFileReferenceError } from "./files";
import {
  contentDeliveryConflict,
  contentFileRejected,
  contentUnprocessable,
  rethrowAsHttpError,
} from "./http-errors";

/** A structured 409, in the translation union. */
export const contentTranslationConflict = (
  body: ContentTranslationConflict,
): HTTPException =>
  new HTTPException(409, { res: Response.json(body, { status: 409 }) });

export const withTranslationHttpErrors = async <TResult>(
  action: "create" | "delete" | "read" | "update",
  run: () => Promise<TResult>,
  {
    contentTypeId,
    itemId,
    locale,
  }: {
    contentTypeId: string;
    /** Absent on a read, which has no row to attribute a constraint failure to. */
    itemId?: number;
    locale?: string;
  },
): Promise<TResult> => {
  try {
    return await run();
  } catch (error) {
    if (error instanceof HTTPException) throw error;

    // A restore whose snapshot no longer fits the content type. Mapped here
    // rather than left to the shared mapper so the 422 body is produced whether
    // or not the caller asked for structured errors - a translation route always
    // answers this way, and its OpenAPI schema says so.
    if (error instanceof ContentRevisionNotRestorable) {
      throw contentUnprocessable({
        code: CONTENT_UNPROCESSABLE_CODES.notRestorable,
        contentTypeId,
        fields: error.fields,
        revisionId: error.revisionId,
      });
    }

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

    // Answered in the **delivery** union rather than translated into
    // `CONTENT_TRANSLATION_UNIQUE_CONFLICT`, and the difference matters to a client:
    // a unique clash means another record holds that address *now*, so switching to
    // it is impossible; a reservation means another record *used* to hold it and it
    // still redirects, which is a different thing to explain and possibly to undo.
    // It also has to be caught here rather than left to the fallthrough below, which
    // rewrites every 409 the shared mapper produces into the unique-clash arm.
    if (error instanceof ContentDeliverySlugReserved) {
      throw contentDeliveryConflict({
        code: CONTENT_DELIVERY_CODES.slugReserved,
        contentTypeId,
        locale: error.locale,
        slug: error.slug,
      });
    }

    // Ahead of the generic `ContentInputError` branch for the same reason as in
    // the shared mapper: the code and the field are what let a form point at the
    // input that was refused. A file field is always shared, so this is reached
    // by a composite write rather than by a translation-only one - and it has to
    // answer identically whichever mapper saw it.
    if (error instanceof ContentFileReferenceError) {
      throw contentFileRejected({
        code: error.code,
        field: error.field,
        message: error.detail,
      });
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
      // `read` has no write semantics for the shared mapper to describe, so it is
      // reported as an update - the only paths it can reach there are the generic
      // ones, and a read never hits a constraint.
      return rethrowAsHttpError(error, {
        action: action === "read" ? "update" : action,
        contentTypeId,
        itemId,
      });
    } catch (mapped) {
      // A localized unique clash is a slug that is taken *in this language*, so
      // it answers in the translation union with the locale attached rather than
      // with the base 409 the shared mapper produces.
      if (mapped instanceof HTTPException && mapped.status === 409) {
        throw contentTranslationConflict({
          code: CONTENT_TRANSLATION_CONFLICT_CODES.unique,
          contentTypeId,
          itemId: itemId ?? null,
          locale: locale ?? "",
        });
      }

      throw mapped;
    }
  }
};

import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";

import type {
  ContentConflict,
  ContentDeliveryConflict,
  ContentUnprocessable,
} from "../conflicts";
import type { ContentScheduleCode } from "../schedules";

import { PG_ERROR_CODES, pgErrorCode } from "../../lib/api/pg-error";
import {
  CONTENT_CONFLICT_CODES,
  CONTENT_DELIVERY_CODES,
  CONTENT_UNPROCESSABLE_CODES,
} from "../const";
import {
  ContentDeliverySlugReserved,
  ContentInputError,
  ContentRevisionNotRestorable,
  ContentScheduleError,
  ContentVersionConflict,
} from "../errors";
import { ContentFileReferenceError } from "./files";

const {
  foreignKeyViolation: FOREIGN_KEY_VIOLATION,
  notNullViolation: NOT_NULL_VIOLATION,
  restrictViolation: RESTRICT_VIOLATION,
  uniqueViolation: UNIQUE_VIOLATION,
} = PG_ERROR_CODES;

const jsonError = (status: 400 | 409 | 422, body: unknown): HTTPException =>
  new HTTPException(status, {
    res: Response.json(body, { status }),
  });

/** A structured 409. Editorial content types only - see `zodContentConflict`. */
export const contentConflict = (body: ContentConflict): HTTPException =>
  jsonError(409, body);

export const contentDeliveryConflict = (
  body: ContentDeliveryConflict,
): HTTPException => jsonError(409, body);

/** A structured 422, for a revision that no longer fits the content type. */
export const contentUnprocessable = (
  body: ContentUnprocessable,
): HTTPException => jsonError(422, body);

export const contentFileRejected = (body: {
  code: string;
  field: string;
  message: string;
}): HTTPException => jsonError(400, body);

export const contentScheduleRejected = (body: {
  code: ContentScheduleCode;
  contentTypeId: string;
}): HTTPException => jsonError(400, body);

export const rethrowAsHttpError = (
  error: unknown,
  {
    action,
    contentTypeId,
    itemId,
    structured = false,
  }: {
    action: "create" | "delete" | "update";
    contentTypeId?: string;
    itemId?: number;
    structured?: boolean;
  },
): never => {
  if (error instanceof ContentVersionConflict) {
    throw contentConflict({
      code: CONTENT_CONFLICT_CODES.version,
      contentTypeId: error.contentTypeId ?? contentTypeId ?? "",
      currentVersion: error.currentVersion,
      expectedVersion: error.expectedVersion,
      itemId: error.itemId,
    });
  }

  // Before the generic unique-violation mapping below, and before
  // `ContentInputError`: a reserved address is a 409 that names the slug and the
  // locale, where the driver's own `23505` cannot say which of the two constraints
  // - the live slug index or the history reservation - refused the write.
  if (error instanceof ContentDeliverySlugReserved) {
    throw contentDeliveryConflict({
      code: CONTENT_DELIVERY_CODES.slugReserved,
      contentTypeId: error.contentTypeId ?? contentTypeId ?? "",
      locale: error.locale,
      slug: error.slug,
    });
  }

  if (error instanceof ContentScheduleError) {
    throw contentScheduleRejected({
      code: error.code,
      contentTypeId: error.contentTypeId ?? contentTypeId ?? "",
    });
  }

  if (error instanceof ContentRevisionNotRestorable) {
    throw contentUnprocessable({
      code: CONTENT_UNPROCESSABLE_CODES.notRestorable,
      contentTypeId: error.contentTypeId ?? contentTypeId ?? "",
      fields: error.fields,
      revisionId: error.revisionId,
    });
  }

  // The service validates its own input, so a payload that slipped past the
  // route's validator surfaces here. The issue tree stays out of the response:
  // it names internal field paths, and the route schema already described the
  // contract in OpenAPI.
  if (error instanceof ZodError) {
    throw new HTTPException(400, { message: "Invalid input data." });
  }

  // Before the generic `ContentInputError` branch below, which is what this used
  // to fall through to: that keeps the sentence and drops `code` and `field`,
  // the two parts a form can act on. A `ContentFileReferenceError` is the same
  // 400 either way - it just says which field and which rule.
  if (error instanceof ContentFileReferenceError) {
    throw contentFileRejected({
      code: error.code,
      field: error.field,
      message: error.detail,
    });
  }

  // Written for the client on purpose - "provide the slug explicitly" is
  // useless if it never leaves the server.
  if (error instanceof ContentInputError) {
    throw new HTTPException(400, { message: error.message });
  }

  switch (pgErrorCode(error)) {
    case FOREIGN_KEY_VIOLATION:
      throw new HTTPException(action === "delete" ? 409 : 400, {
        message:
          action === "delete"
            ? "This record is still referenced by other content."
            : "A related record does not exist.",
      });
    case RESTRICT_VIOLATION:
      throw new HTTPException(409, {
        message: "This record is still referenced by other content.",
      });
    case NOT_NULL_VIOLATION:
      throw new HTTPException(400, { message: "A required field is missing." });
    case UNIQUE_VIOLATION:
      // Same status either way; an editorial route just says it in a shape a
      // client can branch on, alongside the version conflict it shares with.
      throw structured
        ? contentConflict({
            code: CONTENT_CONFLICT_CODES.unique,
            contentTypeId: contentTypeId ?? "",
            itemId: itemId ?? null,
          })
        : new HTTPException(409, {
            message: "A record with these values already exists.",
          });
    default:
      throw error;
  }
};

export interface ContentHttpErrorOptions {
  contentTypeId?: string;
  itemId?: number;
  /** Answer 409 and 422 with a JSON body. Editorial content types only. */
  structured?: boolean;
}

/** Runs a write and maps any constraint failure onto an HTTP status. */
export const withHttpErrors = async <TResult>(
  action: "create" | "delete" | "update",
  run: () => Promise<TResult>,
  options: ContentHttpErrorOptions = {},
): Promise<TResult> => {
  try {
    return await run();
  } catch (error) {
    if (error instanceof HTTPException) throw error;

    return rethrowAsHttpError(error, { action, ...options });
  }
};

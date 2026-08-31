import type { z } from "zod";

import {
  parseContentConflict,
  parseContentDeliveryConflict,
  parseContentScheduleRejection,
  parseContentTranslationConflict,
  parseContentUnprocessable,
} from "@/content/conflicts";

import type { ContentMutationResult } from "../content-mutation";
import type { ContentApiRequest } from "../content-request";

import { contentApiFetchInBrowser } from "../content-request";

/**
 * One request to a generated Content Engine route, and one reading of what came
 * back - shared by every browser write in the AdminCP.
 *
 * Three functions, and they exist as three rather than as three copies. The
 * form's transport, the list row's writes and the editorial panels all speak to
 * the same generated routes and all have to answer the same question about a
 * refusal: *which* refusal was it? A `409` is either "somebody saved before you"
 * or "that value is taken", the two need different words and different buttons,
 * and the only thing that tells them apart is a `code` in the body.
 *
 * That reading was written out twice before this module - once in
 * `../actions/mutation-api.server.ts` for Next.js and once in
 * `../form/mutations-api.ts` for the browser - and the editorial panels would
 * have made it three. Three copies of a five-parser mapping is three chances for
 * one screen to quietly lose the conflict flow, so there is one.
 *
 * ## A result, not a throw
 *
 * The rule the whole AdminCP write path follows, stated once here: a failed
 * *read* must reject, or a screen renders as though there were nothing to show;
 * a failed *write* must resolve, or the dialog that is still open - still holding
 * the values somebody is being asked about - is replaced by an error boundary. A
 * version conflict in particular is not an error in the UI sense at all. It is a
 * question, and it has to be answerable in the form it was asked in.
 *
 * `rawApiFetch` throws on a `500` rather than answering, so that is caught here
 * and turned back into a status. Everything else already arrives as one.
 */

/** The shape `contentApiFetch` answers with on the server, read in a browser. */
export interface ContentFetchResult<TData> {
  data?: TData;
  error?: string;
  status: number;
}

/** The sentence a body that does not match the content type's schema gets. */
export const CONTENT_SCHEMA_MISMATCH =
  "The API returned a response this content type does not describe.";

/**
 * A `500`, or the API being unreachable, as a result rather than a throw.
 *
 * `rawApiFetch` throws on a `500`, and the thrown message carries the response
 * body after a newline. In the Next.js path that rejection travelled out of the
 * Server Action and was reported by the framework; here it has to become the
 * generic server-error toast every caller already knows how to show, which is
 * what `contentErrorKey(500)` resolving to `null` produces.
 */
export const unreachableContentResult = (
  error: unknown,
): ContentFetchResult<never> => ({
  error: error instanceof Error ? error.message : "",
  status: 500,
});

/**
 * One request, with the response read exactly as the Next.js side reads it.
 *
 * A body that does not match the content type's own schema is an error rather
 * than partial data: it means the installed plugin and the running API disagree
 * about a shape, and acting on half a record on that basis would be worse than
 * refusing.
 */
export const sendContentApiRequest = async <TSchema extends z.ZodType>(
  request: ContentApiRequest,
  schema?: TSchema,
): Promise<ContentFetchResult<z.infer<TSchema>>> => {
  let response: Response;

  try {
    response = await contentApiFetchInBrowser(request);
  } catch (error) {
    return unreachableContentResult(error);
  }

  if (!response.ok) {
    return { error: await response.text(), status: response.status };
  }

  const payload: unknown = await response.json();
  if (!schema) {
    return { data: payload as z.infer<TSchema>, status: response.status };
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return { error: CONTENT_SCHEMA_MISMATCH, status: response.status };
  }

  return { data: parsed.data, status: response.status };
};

/**
 * Whether a response is one a write may act on.
 *
 * The status **and** the absence of an error, and the second half is not
 * redundant: {@link sendContentApiRequest} reports an undescribable body as an
 * error while keeping the status the API sent, so a create whose `201` carried
 * an unreadable body would otherwise read as a success with no identifier - and
 * a page-mode create would navigate to record `0`.
 */
export const contentWriteSucceeded = (
  result: { error?: string; status: number },
  status: number,
): boolean => result.status === status && result.error === undefined;

/**
 * Reads whatever structured error the API sent, if any.
 *
 * The one conflict mapper. Member for member what `mutation-api.server.ts` does,
 * through the same five parsers, so a version conflict raised by a form, by a
 * row's delete and by a revision restore all arrive in the same field with the
 * same code - and one screen cannot silently lose a branch the others have.
 */
export const contentFailureResult = (result: {
  error?: string;
  status: number;
}): ContentMutationResult => ({
  conflict: parseContentConflict(result.error) ?? undefined,
  delivery: parseContentDeliveryConflict(result.error) ?? undefined,
  error: result.error ?? "",
  rejection: parseContentScheduleRejection(result.error) ?? undefined,
  status: result.status,
  translationConflict:
    parseContentTranslationConflict(result.error) ?? undefined,
  unprocessable: parseContentUnprocessable(result.error) ?? undefined,
});

/**
 * The version off a mutation response, when the row carries one.
 *
 * `undefined` for a content type with no `editorial`, which has no version to
 * send and no conflict to have.
 */
export const contentVersionOf = (
  row?: Record<string, unknown>,
): number | undefined =>
  typeof row?.version === "number" ? row.version : undefined;

import type { ContentPublicationAction } from "@/content/publication";

import type { ContentMutationResult } from "../content-mutation";
import type { ContentApiTarget } from "../content-request";

import { contentApiFetchInBrowser } from "../content-request";
import { contentFailureResult } from "../lib/api-result";

/**
 * The three writes a content **list row** performs, from the browser.
 *
 * Publish, unpublish and delete - the ones that live on a row rather than in a
 * form, and the only ones this module owns. Creating and editing are the form's
 * (`../actions/`), and restoring a revision, scheduling and delivery are the
 * editorial panels'.
 *
 * ## Why these exist beside the Server Actions rather than replacing them
 *
 * `../actions/mutation-api.server.ts` does the same three calls and then does
 * something no browser can: `revalidatePath` and `revalidateContent` expire
 * Next's *data cache*, which is what makes a published record appear on the
 * public site. A TanStack Start application has no such cache - its public pages
 * are rendered per request - so the equivalent work is exactly the API call plus
 * a query invalidation, and there is nothing to skip.
 *
 * ## A result, not a throw
 *
 * The opposite of `readContentApiJson`, deliberately, and the reason is the
 * dialog. A *read* that fails must reject, or the table renders empty and looks
 * like an installation with nothing in it. A *write* that fails is answered by
 * the confirmation dialog that is still open: it has to tell the difference
 * between "someone saved first" (offer to reload), "you may not do that" and
 * "the server fell over" - and it has to keep the dialog open for the first,
 * which a thrown error inside an error boundary cannot do.
 *
 * `rawApiFetch` throws on a `500` rather than answering, so that is caught and
 * turned back into a status. Everything else already arrives as one.
 *
 * ## The refusal is read by the shared mapper
 *
 * `contentFailureResult` in `../lib/api-result.ts`, which is the same five
 * parsers the form's transport and the editorial panels read a refusal with. A
 * row write is not a lesser kind of write: deleting a record can be refused with
 * `CONTENT_VERSION_CONFLICT` exactly as a save can, and a delete that moves a
 * slug can be refused with `CONTENT_DELIVERY_SLUG_RESERVED`. Reading only the
 * first of those - which this module did until Stage 13 - meant a row's toast
 * fell back to "the server fell over" for a condition the API had named.
 */

/**
 * What a row write answered. `error` is absent exactly when it worked.
 *
 * `status` is required here where {@link ContentMutationResult} leaves it
 * optional, because every one of these results comes from a request that was
 * actually sent - there is no `unchanged` short-circuit on a row.
 */
export type ContentRowMutationResult = ContentMutationResult & {
  status: number;
};

/** A `500`, or the API being unreachable, as a result rather than a throw. */
const UNREACHABLE: ContentRowMutationResult = {
  error: "The API could not be reached.",
  status: 500,
};

const readResult = async (
  send: () => Promise<Response>,
): Promise<ContentRowMutationResult> => {
  let response: Response;

  try {
    response = await send();
  } catch {
    return UNREACHABLE;
  }

  if (response.ok) return { status: response.status };

  return {
    ...contentFailureResult({
      error: await response.text(),
      status: response.status,
    }),
    status: response.status,
  };
};

export interface ContentRowMutationArgs {
  id: number;
  target: ContentApiTarget;
}

/**
 * Moves one record into or out of the published state.
 *
 * Idempotent at the API, which is what makes it safe to fire from a row whose
 * status may already have changed under the administrator: publishing a
 * published record is a `200` that changed nothing rather than a `409`.
 */
export const setContentPublicationInBrowser = async ({
  action,
  id,
  target,
}: ContentRowMutationArgs & {
  /** The transition to perform, from `contentPublicationTransition`. */
  action: ContentPublicationAction;
}): Promise<ContentRowMutationResult> =>
  await readResult(
    async () =>
      await contentApiFetchInBrowser({
        method: "post",
        path: `/${id}/${action}`,
        target,
      }),
  );

/**
 * Deletes one record.
 *
 * `expectedVersion` travels in the body of the `DELETE`, matching the route: an
 * editorial content type requires it, and every other one ignores it - so the
 * table passes the version it rendered unconditionally and the API decides
 * whether it mattered. A mismatch is a `409` carrying
 * `CONTENT_VERSION_CONFLICT`, which the dialog turns into "this record changed"
 * rather than into a failed delete nobody can explain.
 */
export const deleteContentInBrowser = async ({
  editorial,
  id,
  target,
  version,
}: ContentRowMutationArgs & {
  /** Whether this content type's delete route takes a precondition at all. */
  editorial: boolean;
  version?: number;
}): Promise<ContentRowMutationResult> =>
  await readResult(
    async () =>
      await contentApiFetchInBrowser({
        ...(editorial ? { body: { expectedVersion: version } } : {}),
        method: "delete",
        path: `/${id}`,
        target,
      }),
  );

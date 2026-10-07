import type { ContentPublicationAction } from "@/content/publication";
import type { ContentVisibilityAction } from "@/content/visibility";

import type { ContentMutationResult } from "../content-mutation";
import type { ContentApiTarget } from "../content-request";

import { contentApiFetch } from "../content-request";
import { contentFailureResult } from "../lib/api-result";

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
      await contentApiFetch({
        method: "post",
        path: `/${id}/${action}`,
        target,
      }),
  );

/**
 * Hides or unhides one record from the table.
 *
 * Idempotent on the server, like publishing: hiding a record that is already
 * hidden is a `200` that changed nothing, so a stale row resolves itself.
 * `expectedVersion` is optional and only checked by an editorial content type -
 * send the version the row was rendered with when a `409` should stop the click
 * on a record somebody else just changed. Gated by `can_hide`.
 */
export const setContentVisibilityInBrowser = async ({
  action,
  expectedVersion,
  id,
  target,
}: ContentRowMutationArgs & {
  /** The transition to perform, from `contentVisibilityTransition`. */
  action: ContentVisibilityAction;
  expectedVersion?: number;
}): Promise<ContentRowMutationResult> =>
  await readResult(
    async () =>
      await contentApiFetch({
        ...(expectedVersion === undefined ? {} : { body: { expectedVersion } }),
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
      await contentApiFetch({
        ...(editorial ? { body: { expectedVersion: version } } : {}),
        method: "delete",
        path: `/${id}`,
        target,
      }),
  );

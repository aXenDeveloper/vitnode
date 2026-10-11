import type { ContentId } from "@/content/ids";
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
  id: ContentId;
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

export interface ContentDuplicateInput {
  overrides?: Record<string, unknown>;
  translations?: Record<string, Record<string, unknown>>;
}

export interface ContentDuplicatePayload {
  id: ContentId;
  locales: string[];
  row: Record<string, unknown>;
  skippedLocales: string[];
  sourceId: ContentId;
}

export type ContentDuplicateMutationResult = ContentRowMutationResult & {
  duplicated?: ContentDuplicatePayload;
};

export const duplicateContentInBrowser = async ({
  id,
  input = {},
  target,
}: ContentRowMutationArgs & {
  input?: ContentDuplicateInput;
}): Promise<ContentDuplicateMutationResult> => {
  let response: Response;

  try {
    response = await contentApiFetch({
      body: input,
      method: "post",
      path: `/${id}/duplicate`,
      target,
    });
  } catch {
    return UNREACHABLE;
  }

  if (!response.ok) {
    return {
      ...contentFailureResult({
        error: await response.text(),
        status: response.status,
      }),
      status: response.status,
    };
  }

  const duplicated = (await response.json()) as ContentDuplicatePayload;

  return { duplicated, id: duplicated.id, status: response.status };
};

export const setContentVisibilityInBrowser = async ({
  action,
  expectedVersion,
  id,
  target,
}: ContentRowMutationArgs & {
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

import type { ContentPublicationAction } from "@/content/publication";

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

export interface ContentDuplicateInput {
  /** Shared values for the copy. A group merges leaf by leaf. */
  overrides?: Record<string, unknown>;
  /** Localized values per copied locale, merged the same way. */
  translations?: Record<string, Record<string, unknown>>;
}

/** What `POST /{id}/duplicate` answers with on a `201`. */
export interface ContentDuplicatePayload {
  id: number;
  /** The copied translations' locales, default locale first. */
  locales: string[];
  row: Record<string, unknown>;
  /** Source locales switched off in this install, which the copy does not carry. */
  skippedLocales: string[];
  sourceId: number;
}

export type ContentDuplicateMutationResult = ContentRowMutationResult & {
  /** Present on success: the copy, so the caller can open it. */
  duplicated?: ContentDuplicatePayload;
};

/**
 * Copies one record as a draft. A refusal comes back with `duplicate` set when it
 * names a field to fix - `CONTENT_DUPLICATE_SLUG_CONFLICT` (409) or
 * `CONTENT_DUPLICATE_UNIQUE_REQUIRED` (422) - and with `status` either way.
 */
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

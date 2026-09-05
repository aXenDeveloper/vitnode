import { z } from "zod";

import type {
  ContentRevisionDetail,
  ContentRevisionMeta,
} from "@/content/revisions";
import type {
  ContentSchedule,
  ContentScheduleAction,
} from "@/content/schedules";

import type { ContentMutationResult } from "../content-mutation";
import type { ContentApiTarget } from "../content-request";

import {
  contentFailureResult,
  contentVersionOf,
  contentWriteSucceeded,
  sendContentApiRequest,
} from "../lib/api-result";

const zodRevisionList = z.object({
  edges: z.array(z.object({ id: z.number() }).loose()),
  pageInfo: z.object({
    endCursor: z.number().nullable(),
    hasNextPage: z.boolean(),
  }),
});

const zodRevision = z.object({ id: z.number() }).loose();

const zodRow = z.object({ id: z.number() }).loose();

const zodRestoreResult = z.object({ changed: z.boolean(), row: zodRow });

const zodPreview = z.object({
  expiresAt: z.string(),
  revisionId: z.number(),
  token: z.string(),
  url: z.string(),
  version: z.number(),
});

const zodScheduleList = z.object({
  edges: z.array(z.object({ id: z.number() }).loose()),
  hasCronAdapter: z.boolean(),
});

const zodDeliveryEntry = z.object({
  createdAt: z.coerce.date(),
  path: z.string(),
  /** `null` while this is the record's current address. */
  retiredAt: z.coerce.date().nullable(),
  slug: z.string(),
});

const zodDelivery = z.object({
  canonicalPath: z.string().nullable(),
  history: z.array(zodDeliveryEntry),
  isPublic: z.boolean(),
  locale: z.string().nullable(),
});

export type ContentDeliveryPanelData = z.infer<typeof zodDelivery>;

export interface ContentDeliveryPanelResult {
  data?: ContentDeliveryPanelData;
  error?: string;
}

export interface ContentRevisionPageResult {
  edges: ContentRevisionMeta[];
  error?: string;
  pageInfo: { endCursor: null | number; hasNextPage: boolean };
}

export interface ContentPreviewLink {
  expiresAt: string;
  revisionId: number;
  url: string;
  version: number;
}

export interface ContentPreviewResult {
  error?: string;
  preview?: ContentPreviewLink;
  status?: number;
}

export interface ContentScheduleListResult {
  edges: ContentSchedule[];
  error?: string;
  hasCronAdapter: boolean;
}

const EMPTY_PAGE_INFO = { endCursor: null, hasNextPage: false } as const;

export const listContentRevisionsInBrowser = async (
  target: ContentApiTarget,
  id: number,
  cursor?: number,
): Promise<ContentRevisionPageResult> => {
  const result = await sendContentApiRequest(
    {
      method: "get",
      path: `/${id}/revisions`,
      ...(cursor === undefined ? {} : { query: { cursor: String(cursor) } }),
      target,
    },
    zodRevisionList,
  );

  if (!contentWriteSucceeded(result, 200) || !result.data) {
    return { edges: [], error: result.error ?? "", pageInfo: EMPTY_PAGE_INFO };
  }

  return {
    edges: result.data.edges as unknown as ContentRevisionMeta[],
    pageInfo: result.data.pageInfo,
  };
};

export const getContentRevisionInBrowser = async (
  target: ContentApiTarget,
  id: number,
  revisionId: number,
): Promise<{ error?: string; revision?: ContentRevisionDetail }> => {
  const result = await sendContentApiRequest(
    { method: "get", path: `/${id}/revisions/${revisionId}`, target },
    zodRevision,
  );

  if (!contentWriteSucceeded(result, 200) || !result.data) {
    return { error: result.error ?? "" };
  }

  return { revision: result.data as unknown as ContentRevisionDetail };
};

/**
 * Restores one revision, and reports the version the record now holds.
 *
 * The version comes back because the history dialog stays open afterwards: its
 * next restore needs the *new* precondition, and reusing the one it opened with
 * would fail with a conflict against the restore it just performed.
 */
export const restoreContentRevisionInBrowser = async (
  target: ContentApiTarget,
  id: number,
  revisionId: number,
  expectedVersion: number,
): Promise<ContentMutationResult> => {
  const result = await sendContentApiRequest(
    {
      body: { expectedVersion },
      method: "post",
      path: `/${id}/revisions/${revisionId}/restore`,
      target,
    },
    zodRestoreResult,
  );

  if (!contentWriteSucceeded(result, 200)) return contentFailureResult(result);

  return { version: contentVersionOf(result.data?.row) };
};

/**
 * Mints a preview link, on the click and not before.
 *
 * Nothing here is cached: no row changed, and a token is a short-lived bearer
 * credential for an unpublished record. Handing one to every row of the table
 * "just in case" would mean a page of live credentials sitting in a browser,
 * most of them never used.
 *
 * The `url` comes back from the server rather than being assembled here, because
 * only the server knows which of the three it should be: a dedicated preview
 * page, the record's own canonical page carrying `?preview=`, or the JSON
 * endpoint when there is no page at all.
 */
export const createContentPreviewInBrowser = async (
  target: ContentApiTarget,
  id: number,
): Promise<ContentPreviewResult> => {
  const result = await sendContentApiRequest(
    { method: "post", path: `/${id}/preview`, target },
    zodPreview,
  );

  if (!contentWriteSucceeded(result, 200) || !result.data) {
    return { error: result.error ?? "", status: result.status };
  }

  const { expiresAt, revisionId, url, version } = result.data;

  // The token itself is deliberately not returned: it is already inside `url`,
  // and a second copy is a second thing to leak.
  return { preview: { expiresAt, revisionId, url, version } };
};

export const listContentSchedulesInBrowser = async (
  target: ContentApiTarget,
  id: number,
): Promise<ContentScheduleListResult> => {
  const result = await sendContentApiRequest(
    { method: "get", path: `/${id}/schedules`, target },
    zodScheduleList,
  );

  if (!contentWriteSucceeded(result, 200) || !result.data) {
    // `hasCronAdapter: true` when the read failed, on purpose: the warning it
    // drives says "nothing will run these", and showing that because a request
    // fell over would be telling the administrator something untrue about their
    // installation.
    return { edges: [], error: result.error ?? "", hasCronAdapter: true };
  }

  return {
    edges: result.data.edges as unknown as ContentSchedule[],
    hasCronAdapter: result.data.hasCronAdapter,
  };
};

/**
 * Books a publication or an unpublication for later.
 *
 * Nothing public changes yet - the transition itself expires the public cache
 * when it fires, over the revalidation bridge. What changes now is the admin
 * table, which grows a pending badge.
 */
export const scheduleContentInBrowser = async (
  target: ContentApiTarget,
  id: number,
  action: ContentScheduleAction,
  scheduledFor: string,
): Promise<ContentMutationResult> => {
  const result = await sendContentApiRequest(
    {
      body: { action, scheduledFor },
      method: "post",
      path: `/${id}/schedule`,
      target,
    },
    z.object({ id: z.number() }),
  );

  if (!contentWriteSucceeded(result, 200)) return contentFailureResult(result);

  return {};
};

export const cancelContentScheduleInBrowser = async (
  target: ContentApiTarget,
  id: number,
  scheduleId: number,
): Promise<ContentMutationResult> => {
  const result = await sendContentApiRequest(
    {
      method: "post",
      path: `/${id}/schedule/${scheduleId}/cancel`,
      target,
    },
    z.object({ cancelled: z.boolean() }),
  );

  if (!contentWriteSucceeded(result, 200)) return contentFailureResult(result);

  return {};
};

/**
 * Reads one record's delivery state.
 *
 * `locale` is the **content translation's** locale and not the administrator's
 * interface language - it selects which language's canonical path is being asked
 * about, and is sent only for a content type that has translations. The caller
 * decides that; see `contentDeliveryRequestLocale` in `./delivery-model.ts`.
 *
 * `can_view` is enforced by the route this calls. There is deliberately no
 * `can_manage_redirects`: this screen manages nothing.
 */
export const readContentDeliveryInBrowser = async (
  target: ContentApiTarget,
  id: number,
  locale?: string,
): Promise<ContentDeliveryPanelResult> => {
  const result = await sendContentApiRequest(
    {
      method: "get",
      path: `/${id}/delivery`,
      ...(locale === undefined ? {} : { query: { locale } }),
      target,
    },
    zodDelivery,
  );

  if (!contentWriteSucceeded(result, 200) || !result.data) {
    return { error: result.error ?? "" };
  }

  return { data: result.data };
};

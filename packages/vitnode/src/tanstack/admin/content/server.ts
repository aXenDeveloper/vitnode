import "@tanstack/react-start/server-only";

import type { ContentApiRequest } from "@/views/admin/views/content/content-request";
import type {
  ContentListPageFetcher,
  ContentListRequest,
} from "@/views/admin/views/content/table/list-query";

import { rawApiFetch } from "@/lib/fetcher/raw";
import { contentApiFetchArgs } from "@/views/admin/views/content/content-request";
import { readContentApiJson } from "@/views/admin/views/content/content-request";
import {
  contentListApiRequest,
  describeContentList,
  zodContentListPage,
} from "@/views/admin/views/content/table/list-query";

import { getForwardedApiHeaders, resolveApiOrigin } from "../../fetcher/server";

/**
 * The server half of the Content Engine transport.
 *
 * `getForwardedApiHeaders()` carries the admin cookie the page request arrived
 * with, which here is the difference between a content list and a `403`, and
 * `resolveApiOrigin()` calls the origin this request came in on rather than a
 * configured one - which is what makes a preview deployment work.
 *
 * Reached only through `./query`'s isomorphic function, so this module - and the
 * `server-only` marker above it - never enters the browser bundle.
 *
 * It calls `rawApiFetch` rather than `fetcherServer` for the reason
 * `content-request.ts` gives at length: `fetcherServer` is `coreFetcher` with
 * headers attached, and `coreFetcher` needs a typed module reference that a
 * generated content module does not have. The headers and the origin are the
 * only parts of `fetcherServer` that matter here, and both are taken directly.
 */
export const contentApiFetchOnServer = async (
  request: ContentApiRequest,
): Promise<Response> =>
  await rawApiFetch({
    ...contentApiFetchArgs(request),
    additionalHeaders: getForwardedApiHeaders(),
    origin: resolveApiOrigin(),
  });

/**
 * One page of a content list, during a server render.
 *
 * The server half of {@link ContentListPageFetcher}: the same request the
 * browser builds, sent from inside the page request that is being rendered so
 * the administrator's cookie travels with it, and read through the same schema
 * so a mismatch is a rejected query on both sides rather than a half-rendered
 * row on one.
 */
export const fetchContentListPageOnServer: ContentListPageFetcher = async (
  request: ContentListRequest,
) =>
  await readContentApiJson(
    await contentApiFetchOnServer(contentListApiRequest(request)),
    { describe: describeContentList(request), schema: zodContentListPage },
  );

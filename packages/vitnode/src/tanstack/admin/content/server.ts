import "@tanstack/react-start/server-only";

import type { ContentApiRequest } from "@/views/admin/views/content/content-request";
import type { ContentListRequest } from "@/views/admin/views/content/table/list-query";

import { contentApiFetchArgs } from "@/views/admin/views/content/content-request";
import { readContentApiJson } from "@/views/admin/views/content/content-request";
import {
  contentListApiRequest,
  describeContentList,
  zodContentListPage,
} from "@/views/admin/views/content/table/list-query";

import { rawFetcher } from "../../fetcher/server";

export const contentApiFetchOnServer = async (
  request: ContentApiRequest,
): Promise<Response> => await rawFetcher(contentApiFetchArgs(request));

export const fetchContentListPageOnServer = async (
  request: ContentListRequest,
) =>
  await readContentApiJson(
    await contentApiFetchOnServer(contentListApiRequest(request)),
    { describe: describeContentList(request), schema: zodContentListPage },
  );

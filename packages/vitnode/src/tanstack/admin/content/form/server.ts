import "@tanstack/react-start/server-only";

import type { TranslationRow } from "@/views/admin/views/content/content-mutation";
import type { ContentItemRequest } from "@/views/admin/views/content/form/item-query";

import { readContentApiJson } from "@/views/admin/views/content/content-request";
import {
  describeContentItem,
  zodContentItem,
  zodContentTranslationList,
} from "@/views/admin/views/content/form/item-query";

import { contentApiFetchOnServer } from "../server";

export const fetchContentItemOnServer = async (request: ContentItemRequest) =>
  await readContentApiJson(
    await contentApiFetchOnServer({
      method: "get",
      path: `/${request.itemId}`,
      target: request.target,
    }),
    { describe: describeContentItem(request), schema: zodContentItem },
  );

export const fetchContentTranslationsOnServer = async (
  request: ContentItemRequest,
) =>
  (
    await readContentApiJson(
      await contentApiFetchOnServer({
        method: "get",
        path: `/${request.itemId}/translations`,
        target: request.target,
      }),
      {
        describe: `${describeContentItem(request)} translations`,
        schema: zodContentTranslationList,
      },
    )
  ).edges as unknown as TranslationRow[];

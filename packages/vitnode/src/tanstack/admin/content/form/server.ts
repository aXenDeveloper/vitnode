import "@tanstack/react-start/server-only";

import type { TranslationRow } from "@/views/admin/views/content/content-mutation";
import type {
  ContentItemFetcher,
  ContentTranslationsFetcher,
} from "@/views/admin/views/content/form/item-query";

import { readContentApiJson } from "@/views/admin/views/content/content-request";
import {
  describeContentItem,
  zodContentItem,
  zodContentTranslationList,
} from "@/views/admin/views/content/form/item-query";

import { contentApiFetchOnServer } from "../server";

/**
 * The two reads a page-mode edit form is warmed with, from the server.
 *
 * The server half of `form/item-query.ts`, and it exists for one reason: an edit
 * form has to arrive populated. The browser fetchers next door are the same two
 * requests over the network; these run inside the request being rendered, so the
 * admin cookie the page arrived with reaches Hono and the loader can fill both
 * cache entries before a single field is painted.
 *
 * Reached only through `./transport`'s isomorphic functions, so this module -
 * and the `server-only` marker above it - never enters the browser bundle.
 */
export const fetchContentItemOnServer: ContentItemFetcher = async request =>
  await readContentApiJson(
    await contentApiFetchOnServer({
      method: "get",
      path: `/${request.itemId}`,
      target: request.target,
    }),
    { describe: describeContentItem(request), schema: zodContentItem },
  );

/**
 * Every language of one record.
 *
 * The response is cast rather than parsed field by field for the reason the
 * browser fetcher gives: a translation's `values` are the content type's own
 * localized fields, which no generic schema can enumerate and which the form
 * needs in full.
 */
export const fetchContentTranslationsOnServer: ContentTranslationsFetcher =
  async request =>
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

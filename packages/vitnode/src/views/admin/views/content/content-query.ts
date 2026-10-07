import type { ContentId } from "@/content/ids";

import { adminQueryRoot } from "@/views/admin/table/query";

/** The screen name this family lives under - `["vitnode","admin","content"]`. */
export const ADMIN_CONTENT_SCREEN = "content";

export const CONTENT_USER_TARGET = "core:users";

export const contentQueryRoot = () => adminQueryRoot(ADMIN_CONTENT_SCREEN);

/** One content type's cache: its list, its records, and every picker onto it. */
export const contentTypeQueryRoot = (contentTypeId: string) =>
  [...contentQueryRoot(), contentTypeId] as const;

export const contentListQueryRoot = (contentTypeId: string) =>
  [...contentTypeQueryRoot(contentTypeId), "list"] as const;

/** One page of one list - the normalised request is the rest of the key. */
export const contentListQueryKey = (contentTypeId: string, params: object) =>
  [...contentListQueryRoot(contentTypeId), params] as const;

export const contentItemQueryRoot = (
  contentTypeId: string,
  itemId: ContentId,
) => [...contentTypeQueryRoot(contentTypeId), "item", itemId] as const;

/** The record itself. */
export const contentItemQueryKey = contentItemQueryRoot;

/** Every translation of one record, values included. */
export const contentTranslationsQueryKey = (
  contentTypeId: string,
  itemId: ContentId,
) => [...contentItemQueryRoot(contentTypeId, itemId), "translations"] as const;

export const contentHistoryQueryRoot = (
  contentTypeId: string,
  itemId: ContentId,
) => [...contentItemQueryRoot(contentTypeId, itemId), "history"] as const;

/** One page of that history, or one revision, named by the request. */
export const contentHistoryQueryKey = (
  contentTypeId: string,
  itemId: ContentId,
  request: object,
) => [...contentHistoryQueryRoot(contentTypeId, itemId), request] as const;

/** One record's publication schedules. */
export const contentSchedulesQueryKey = (
  contentTypeId: string,
  itemId: ContentId,
) => [...contentItemQueryRoot(contentTypeId, itemId), "schedules"] as const;

/** One record's delivery state - its canonical path and URL history. */
export const contentDeliveryQueryKey = (
  contentTypeId: string,
  itemId: ContentId,
) => [...contentItemQueryRoot(contentTypeId, itemId), "delivery"] as const;

export const contentOptionsQueryRoot = (target: string) =>
  [...contentTypeQueryRoot(target), "options"] as const;

export const contentOptionsQueryKey = (
  target: string,
  field: string,
  locale: string,
) => [...contentOptionsQueryRoot(target), field, locale] as const;

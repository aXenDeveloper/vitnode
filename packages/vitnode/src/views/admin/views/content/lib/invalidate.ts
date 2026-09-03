import type { QueryClient } from "@tanstack/react-query";

import {
  contentDeliveryQueryKey,
  contentHistoryQueryRoot,
  contentItemQueryRoot,
  contentListQueryRoot,
  contentOptionsQueryRoot,
  contentSchedulesQueryKey,
  contentTranslationsQueryKey,
} from "../content-query";

/** Every page, sort, search and filter of one content type's list. */
export const invalidateContentList = async (
  queryClient: QueryClient,
  contentTypeId: string,
): Promise<void> => {
  await queryClient.invalidateQueries({
    queryKey: contentListQueryRoot(contentTypeId),
  });
};

export const invalidateContentItem = async (
  queryClient: QueryClient,
  contentTypeId: string,
  itemId: number,
): Promise<void> => {
  await queryClient.invalidateQueries({
    queryKey: contentItemQueryRoot(contentTypeId, itemId),
  });
};

export const removeContentItem = (
  queryClient: QueryClient,
  contentTypeId: string,
  itemId: number,
): void => {
  queryClient.removeQueries({
    queryKey: contentItemQueryRoot(contentTypeId, itemId),
  });
};

export const invalidateContentHistory = async (
  queryClient: QueryClient,
  contentTypeId: string,
  itemId: number,
): Promise<void> => {
  await queryClient.invalidateQueries({
    queryKey: contentHistoryQueryRoot(contentTypeId, itemId),
  });
};

/** Every language of one record, values included. */
export const invalidateContentTranslations = async (
  queryClient: QueryClient,
  contentTypeId: string,
  itemId: number,
): Promise<void> => {
  await queryClient.invalidateQueries({
    queryKey: contentTranslationsQueryKey(contentTypeId, itemId),
  });
};

/** One record's pending and completed publication schedules. */
export const invalidateContentSchedules = async (
  queryClient: QueryClient,
  contentTypeId: string,
  itemId: number,
): Promise<void> => {
  await queryClient.invalidateQueries({
    queryKey: contentSchedulesQueryKey(contentTypeId, itemId),
  });
};

/** One record's canonical path and the addresses it used to answer to. */
export const invalidateContentDelivery = async (
  queryClient: QueryClient,
  contentTypeId: string,
  itemId: number,
): Promise<void> => {
  await queryClient.invalidateQueries({
    queryKey: contentDeliveryQueryKey(contentTypeId, itemId),
  });
};

export const removeContentOptions = (
  queryClient: QueryClient,
  target: string,
): void => {
  queryClient.removeQueries({ queryKey: contentOptionsQueryRoot(target) });
};

import type { QueryClient } from "@tanstack/react-query";

import type { ContentApiTarget } from "@/views/admin/views/content/content-request";
import type {
  ContentItemFetcher,
  ContentTranslationsFetcher,
} from "@/views/admin/views/content/form/item-query";
import type { ContentFormTransport } from "@/views/admin/views/content/form/transport";

import { contentFrontendRegistry } from "@/content/index";
import {
  contentItemFetcher,
  contentTranslationsFetcher,
} from "@/views/admin/views/content/form/item-query";
import {
  createContentInBrowser,
  createLocalizedContentInBrowser,
  editContentInBrowser,
  editLocalizedContentInBrowser,
  listContentTranslationsInBrowser,
  loadContentOptionsInBrowser,
  readContentRowInBrowser,
  setContentPublishedInBrowser,
} from "@/views/admin/views/content/form/mutations-api";

import { contentApiTarget, invalidateContentAfterWrite } from "../query";
import { contentApiFetch } from "../transport";

const fetchContentItem: ContentItemFetcher =
  contentItemFetcher(contentApiFetch);

const fetchContentTranslations: ContentTranslationsFetcher =
  contentTranslationsFetcher(contentApiFetch);

export { fetchContentItem, fetchContentTranslations };

const targetFor = (contentTypeId: string): ContentApiTarget => {
  const entry = contentFrontendRegistry().byId(contentTypeId);

  if (!entry) throw new Error(`Unknown content type "${contentTypeId}".`);

  return contentApiTarget(entry.definition, entry.pluginId);
};

/** Whether this content type's write routes take a version precondition. */
const isEditorial = (contentTypeId: string): boolean =>
  contentFrontendRegistry().byId(contentTypeId)?.definition.editorial
    .enabled === true;

export const contentFormTransport = (
  queryClient: QueryClient,
): ContentFormTransport => {
  /** What a successful write to one record owes the rest of the AdminCP. */
  const settled = async (contentTypeId: string, itemId?: number) => {
    await invalidateContentAfterWrite(queryClient, {
      contentTypeId,
      ...(itemId === undefined ? {} : { itemId }),
    });
  };

  return {
    create: async (contentTypeId, values) => {
      const result = await createContentInBrowser(
        targetFor(contentTypeId),
        values,
      );

      if (result.error === undefined) await settled(contentTypeId, result.id);

      return result;
    },

    createLocalized: async (contentTypeId, values, translations) => {
      const result = await createLocalizedContentInBrowser(
        targetFor(contentTypeId),
        values,
        translations,
      );

      if (result.error === undefined) await settled(contentTypeId, result.id);

      return result;
    },

    edit: async (contentTypeId, itemId, values, expectedVersion) => {
      const result = await editContentInBrowser(targetFor(contentTypeId), {
        editorial: isEditorial(contentTypeId),
        expectedVersion,
        id: itemId,
        values,
      });

      if (result.error === undefined) await settled(contentTypeId, itemId);

      return result;
    },

    editLocalized: async (
      contentTypeId,
      itemId,
      values,
      translations,
      expectedVersion,
    ) => {
      const result = await editLocalizedContentInBrowser(
        targetFor(contentTypeId),
        { expectedVersion, id: itemId, translations, values },
      );

      // `unchanged` never reached the API, so nothing it caches is stale.
      if (result.error === undefined && result.unchanged !== true) {
        await settled(contentTypeId, itemId);
      }

      return result;
    },

    listTranslations: async (contentTypeId, itemId) =>
      await listContentTranslationsInBrowser(targetFor(contentTypeId), itemId),

    loadOptions: async (contentTypeId, field, search, ids) =>
      await loadContentOptionsInBrowser(
        targetFor(contentTypeId),
        field,
        search,
        ids,
      ),

    publish: async (contentTypeId, itemId) => {
      const result = await setContentPublishedInBrowser(
        targetFor(contentTypeId),
        itemId,
        "publish",
      );

      if (result.error === undefined) await settled(contentTypeId, itemId);

      return result;
    },

    reloadRow: async (contentTypeId, itemId) =>
      await readContentRowInBrowser(targetFor(contentTypeId), itemId),

    unpublish: async (contentTypeId, itemId) => {
      const result = await setContentPublishedInBrowser(
        targetFor(contentTypeId),
        itemId,
        "unpublish",
      );

      if (result.error === undefined) await settled(contentTypeId, itemId);

      return result;
    },
  };
};

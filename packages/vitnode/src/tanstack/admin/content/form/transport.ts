import type { QueryClient } from "@tanstack/react-query";

import { createIsomorphicFn } from "@tanstack/react-start";

import type { ContentApiTarget } from "@/views/admin/views/content/content-request";
import type {
  ContentItemFetcher,
  ContentTranslationsFetcher,
} from "@/views/admin/views/content/form/item-query";
import type { ContentFormTransport } from "@/views/admin/views/content/form/transport";

import { contentFrontendRegistry } from "@/content/index";
import {
  fetchContentItemInBrowser,
  fetchContentTranslationsInBrowser,
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
import {
  fetchContentItemOnServer,
  fetchContentTranslationsOnServer,
} from "./server";

/**
 * The Content Engine form's transport, for a TanStack Start host.
 *
 * Three things this module adds to the framework-neutral calls in
 * `views/admin/views/content/form/mutations-api.ts`, and nothing else:
 *
 * 1. **Which module a content type id addresses**, resolved through the
 *    registry the application registered.
 * 2. **What each write owes the cache**, as a query invalidation.
 * 3. **The two reads a page-mode edit form is warmed with**, isomorphically -
 *    from the request being rendered on the server, over the network in the
 *    browser.
 *
 * The Next.js half of the same seam is `form/host-next.tsx`, which hands over
 * the Server Actions unchanged. Neither host knows what the other does, and the
 * form knows neither.
 */

/**
 * The transport boundary for the two page-mode reads.
 *
 * Written out per fetcher rather than behind a helper for the reason
 * `../query.ts` gives: the chained call is what the Start compiler reads to drop
 * the server module from the client bundle, and a wrapper defeats it.
 *
 * The **writes** are deliberately not isomorphic. Every one of them happens
 * because somebody pressed a button, which only ever happens in a browser, so a
 * server branch would be code that cannot run - and `createIsomorphicFn` on the
 * server prefers the server branch, which would then be the one an SSR render
 * silently used if a write ever did reach one.
 */
const fetchContentItem: ContentItemFetcher = createIsomorphicFn()
  .server(fetchContentItemOnServer)
  .client(fetchContentItemInBrowser);

const fetchContentTranslations: ContentTranslationsFetcher =
  createIsomorphicFn()
    .server(fetchContentTranslationsOnServer)
    .client(fetchContentTranslationsInBrowser);

export { fetchContentItem, fetchContentTranslations };

/**
 * Which generated module serves one content type, by id.
 *
 * Through the registry rather than through a prop: a dialog opened from a list
 * row already knows its entry, but the *form* is handed a spec, and a spec
 * carries the content type id. Resolving here is what keeps the transport's
 * signature the same as the Server Actions' - which is what let one form serve
 * both hosts without a second code path.
 *
 * An unknown id throws with the id in the message, exactly as
 * `mutation-api.server.ts`'s `resolve` does. It means the running application
 * has a form open for a content type its registry does not hold, which is a
 * build or configuration fault and not something to paper over with an empty
 * result.
 */
const targetFor = (contentTypeId: string): ContentApiTarget => {
  const entry = contentFrontendRegistry().byId(contentTypeId);

  if (!entry) throw new Error(`Unknown content type "${contentTypeId}".`);

  return contentApiTarget(entry.definition, entry.pluginId);
};

/** Whether this content type's write routes take a version precondition. */
const isEditorial = (contentTypeId: string): boolean =>
  contentFrontendRegistry().byId(contentTypeId)?.definition.editorial
    .enabled === true;

/**
 * Builds the transport a form reads, bound to one query client.
 *
 * Per render rather than per module, because the invalidation half closes over
 * the `QueryClient` - which is per request on a server rendering many visitors
 * at once. `./host.tsx` memoises it against that client, so the identity is
 * stable for the life of the screen and the form's effects do not re-run.
 *
 * ## Only a successful write invalidates
 *
 * Every branch below checks `result.error === undefined` first. A refused save
 * left the record exactly where it was, and refetching the list underneath a
 * dialog that is still open - still holding the values the person is being asked
 * about - would replace what they are looking at while they decide.
 *
 * A **version conflict** is the sharpest case: the record on the server *has*
 * moved, so there is a real argument for refreshing. It still must not, and this
 * is the rule the whole conflict flow rests on - `ConflictNotice` is open over
 * the form, offering to show what changed, and it reads the newer record through
 * `reloadRow` rather than through anything cached. Invalidating here would
 * remount the screen under that dialog and take the editor's unsaved text with
 * it.
 */
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

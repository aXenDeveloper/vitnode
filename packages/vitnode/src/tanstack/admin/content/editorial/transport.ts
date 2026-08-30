import type { QueryClient } from "@tanstack/react-query";

import type { ContentEditorialTransport } from "@/views/admin/views/content/actions/editorial-transport";
import type { ContentApiTarget } from "@/views/admin/views/content/content-request";

import { contentFrontendRegistry } from "@/content/index";
import {
  cancelContentScheduleInBrowser,
  createContentPreviewInBrowser,
  getContentRevisionInBrowser,
  listContentRevisionsInBrowser,
  listContentSchedulesInBrowser,
  readContentDeliveryInBrowser,
  restoreContentRevisionInBrowser,
  scheduleContentInBrowser,
} from "@/views/admin/views/content/actions/editorial-api";
import { invalidateContentSchedules } from "@/views/admin/views/content/lib/invalidate";

import { contentApiTarget, invalidateContentAfterWrite } from "../query";

/**
 * The editorial panels' transport, for a TanStack Start host.
 *
 * The counterpart of `views/admin/views/content/actions/editorial-host-next.tsx`,
 * and it adds exactly two things to the framework-neutral calls in
 * `actions/editorial-api.ts`:
 *
 * 1. **Which module a content type id addresses**, through the registry the
 *    application registered.
 * 2. **What each write owes the cache**, as a query invalidation.
 *
 * Nothing here is isomorphic and nothing should be. Every one of these calls
 * happens because somebody opened a dialog or pressed a button in it, which only
 * ever happens in a browser - so a server branch would be code that cannot run,
 * and `createIsomorphicFn` prefers the server branch during SSR, which would
 * then be the one an accidental server render silently used.
 */

/**
 * Which generated module serves one content type, by id.
 *
 * An unknown id throws with the id in the message, exactly as the form's
 * transport and `mutation-api.server.ts`'s `resolve` do. It means the running
 * application has a panel open for a content type its registry does not hold,
 * which is a build or configuration fault rather than something to paper over
 * with an empty result.
 */
const targetFor = (contentTypeId: string): ContentApiTarget => {
  const entry = contentFrontendRegistry().byId(contentTypeId);

  if (!entry) throw new Error(`Unknown content type "${contentTypeId}".`);

  return contentApiTarget(entry.definition, entry.pluginId);
};

/**
 * Builds the transport a panel reads, bound to one query client.
 *
 * Per render rather than per module, because the invalidation half closes over
 * the `QueryClient` - which is per request on a server rendering many visitors
 * at once. `./host.tsx` memoises it against that client, so the identity is
 * stable for the life of the screen.
 *
 * ## What each scope expires, and why they differ
 *
 * A **restore** rewrites the record: its fields, its version, possibly its slug.
 * So the list is stale (the row's title and status changed), the record is stale,
 * and everything under the record - its translations, its timeline, its delivery
 * addresses - is stale with it. `invalidateContentAfterWrite` is the same call
 * the form's saves make, which is right: a restore *is* a save, performed from a
 * snapshot.
 *
 * A **schedule** booked or cancelled changes nothing about the record yet: the
 * transition happens later, over the revalidation bridge, and the list renders
 * no schedule state at all. So only the schedule list is expired - invalidating
 * the record would refetch a revision timeline nobody asked to reload and re-read
 * a row that has not moved.
 */
export const contentEditorialTransport = (
  queryClient: QueryClient,
): ContentEditorialTransport => ({
  cancelSchedule: async (contentTypeId, itemId, scheduleId) =>
    await cancelContentScheduleInBrowser(
      targetFor(contentTypeId),
      itemId,
      scheduleId,
    ),

  createPreview: async (contentTypeId, itemId) =>
    await createContentPreviewInBrowser(targetFor(contentTypeId), itemId),

  getRevision: async (contentTypeId, itemId, revisionId) =>
    await getContentRevisionInBrowser(
      targetFor(contentTypeId),
      itemId,
      revisionId,
    ),

  listRevisions: async (contentTypeId, itemId, cursor) =>
    await listContentRevisionsInBrowser(
      targetFor(contentTypeId),
      itemId,
      cursor,
    ),

  listSchedules: async (contentTypeId, itemId) =>
    await listContentSchedulesInBrowser(targetFor(contentTypeId), itemId),

  readDelivery: async (contentTypeId, itemId, locale) =>
    await readContentDeliveryInBrowser(
      targetFor(contentTypeId),
      itemId,
      locale,
    ),

  restoreRevision: async (contentTypeId, itemId, revisionId, expectedVersion) =>
    await restoreContentRevisionInBrowser(
      targetFor(contentTypeId),
      itemId,
      revisionId,
      expectedVersion,
    ),

  schedule: async (contentTypeId, itemId, action, scheduledFor) =>
    await scheduleContentInBrowser(
      targetFor(contentTypeId),
      itemId,
      action,
      scheduledFor,
    ),

  settled: async ({ contentTypeId, itemId, scope }) => {
    if (scope === "schedules") {
      await invalidateContentSchedules(queryClient, contentTypeId, itemId);

      return;
    }

    await invalidateContentAfterWrite(queryClient, { contentTypeId, itemId });
  },
});

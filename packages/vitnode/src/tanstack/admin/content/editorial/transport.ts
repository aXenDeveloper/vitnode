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

const targetFor = (contentTypeId: string): ContentApiTarget => {
  const entry = contentFrontendRegistry().byId(contentTypeId);

  if (!entry) throw new Error(`Unknown content type "${contentTypeId}".`);

  return contentApiTarget(entry.definition, entry.pluginId);
};

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

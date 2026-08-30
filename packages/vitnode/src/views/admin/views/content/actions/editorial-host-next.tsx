"use client";

import { useQueryClient } from "@tanstack/react-query";
import React from "react";

import type { ContentEditorialTransport } from "./editorial-transport";

import {
  invalidateContentItem,
  invalidateContentSchedules,
} from "../lib/invalidate";
import { readContentDeliveryAction } from "./delivery-api.server";
import {
  cancelContentScheduleAction,
  createContentPreviewAction,
  getContentRevisionAction,
  listContentRevisionsAction,
  listContentSchedulesAction,
  restoreContentRevisionAction,
  scheduleContentAction,
} from "./mutation-api.server";

/**
 * The editorial panels' seam, wired to Next.js.
 *
 * Every member below is the Server Action it always was, with the arguments it
 * always took. The Next.js path did not move to a new transport; it grew an
 * interface in front of the one it had - `revalidatePath`, the public-locale
 * cache diffing and the `revalidateContent` tag arithmetic all still happen
 * inside those actions, server-side, before they answer.
 *
 * ## What `settled` is left holding
 *
 * Only the *client* half. By the time one of these actions resolves, the server
 * has already expired the cached route segment; what it cannot have touched is
 * the query entries the panel itself reads - the revision timeline, the schedule
 * list - because those live in this browser. So this expires exactly those, and
 * the screen behind the dialog is brought back in step by
 * `ContentFormNavigation.refresh`, which the panels call and `NextContentFormHost`
 * spells as `push(pathname)`.
 *
 * The object is memoised over the query client rather than declared at module
 * scope because a Server Action reference is stable for the life of the bundle
 * but the client is not: a stable identity is what keeps the effects inside the
 * panels from re-running on every render.
 */
export const useNextContentEditorialTransport =
  (): ContentEditorialTransport => {
    const queryClient = useQueryClient();

    return React.useMemo(
      () => ({
        cancelSchedule: cancelContentScheduleAction,
        createPreview: createContentPreviewAction,
        getRevision: getContentRevisionAction,
        listRevisions: listContentRevisionsAction,
        listSchedules: listContentSchedulesAction,
        readDelivery: readContentDeliveryAction,
        restoreRevision: restoreContentRevisionAction,
        schedule: scheduleContentAction,
        settled: async ({ contentTypeId, itemId, scope }) => {
          if (scope === "schedules") {
            await invalidateContentSchedules(
              queryClient,
              contentTypeId,
              itemId,
            );

            return;
          }

          await invalidateContentItem(queryClient, contentTypeId, itemId);
        },
      }),
      [queryClient],
    );
  };

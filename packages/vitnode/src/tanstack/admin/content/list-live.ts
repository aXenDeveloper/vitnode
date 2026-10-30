import { useQueryClient } from "@tanstack/react-query";
import React from "react";

import type { ContentLiveRefreshStatus } from "@/tanstack/content/live-refresh";

import {
  CONTENT_REFRESH_DEBOUNCE_MS,
  CONTENT_REFRESH_MAX_WAIT_MS,
} from "@/content/live/refresh";
import { createCoalescer } from "@/lib/coalesce";
import { useContentLiveRefresh } from "@/tanstack/content/live-refresh";
import { invalidateContentList } from "@/views/admin/views/content/lib/invalidate";

/** Spreads the reads of many open lists after a server restart. */
const RECONNECT_JITTER_MS = 1_500;

/**
 * Keeps one generated AdminCP list current while it is mounted: joins the
 * content type's admin refresh room and, on a signal, refetches the list page
 * on screen - same filters, search, sort and page, rows kept meanwhile - and
 * drops the cached pages nobody looks at. Bursts collapse into one read
 * (`CONTENT_REFRESH_DEBOUNCE_MS`, at most `CONTENT_REFRESH_MAX_WAIT_MS` late)
 * and a join or rejoin reads once to cover what was missed. Used by
 * `ContentListScreen`; every generated list gets it. Browser-only.
 */
export const useContentListLiveRefresh = (
  contentTypeId: string,
): ContentLiveRefreshStatus => {
  const queryClient = useQueryClient();
  const coalescer = React.useMemo(
    () =>
      createCoalescer({
        debounceMs: CONTENT_REFRESH_DEBOUNCE_MS,
        maxWaitMs: CONTENT_REFRESH_MAX_WAIT_MS,
        run: async () => {
          await invalidateContentList(queryClient, contentTypeId);
        },
      }),
    [contentTypeId, queryClient],
  );
  const jitterRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  React.useEffect(
    () => () => {
      clearTimeout(jitterRef.current);
      coalescer.cancel();
    },
    [coalescer],
  );

  const scope = React.useMemo(
    () => ({ contentTypeId, kind: "admin" as const }),
    [contentTypeId],
  );

  return useContentLiveRefresh(scope, {
    onSignal: () => {
      coalescer.schedule();
    },
    onSubscribed: ({ reconnect }) => {
      if (!reconnect) {
        coalescer.schedule();

        return;
      }
      clearTimeout(jitterRef.current);
      jitterRef.current = setTimeout(
        coalescer.schedule,
        Math.random() * RECONNECT_JITTER_MS,
      );
    },
  });
};

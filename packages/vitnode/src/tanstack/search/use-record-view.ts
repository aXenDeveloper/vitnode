import React from "react";

import { recordSearchPopularity } from "@/views/search/search-suggest-query";

/**
 * Records one view of a content item for search popularity ("popular" results
 * and suggestion ranking) when the page mounts or the item changes. Pass
 * `itemId: null` to skip - for a hidden or not-yet-loaded item. Fire and
 * forget: failures are ignored.
 *
 * @example
 * ```tsx
 * import { useRecordView } from "@vitnode/core/tanstack/search";
 *
 * useRecordView({ itemId: metadata.hidden ? null : metadata.itemId, itemType: blogPostContentType.id });
 * ```
 */
export const useRecordView = ({
  itemId,
  itemType,
}: {
  itemId: null | number | string;
  itemType: string;
}): void => {
  React.useEffect(() => {
    // oxlint-disable-next-line react-you-might-not-need-an-effect/no-event-handler
    if (itemId === null) return;

    void recordSearchPopularity({
      itemId: String(itemId),
      itemType,
      signal: "view",
    });
  }, [itemId, itemType]);
};

import React from "react";

import { recordSearchPopularity } from "@/views/search/search-suggest-query";

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

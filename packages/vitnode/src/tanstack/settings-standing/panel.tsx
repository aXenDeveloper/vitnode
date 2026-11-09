import React from "react";

import type { DataTableNavigation } from "@/components/table/navigation";

import { DataTableNavigationProvider } from "@/components/table/navigation";
import { AccountStatusContent } from "@/views/moderation/warnings/account-status-content";

import type { StandingRouteSearch } from "./route";

import { RouteMessages } from "../i18n/route-messages";
import {
  STANDING_NAMESPACES,
  standingHistoryParams,
  standingSearchFrom,
  standingSearchParams,
} from "./route";

export const StandingPanelContent = ({
  navigate,
  search,
}: {
  navigate: (options: {
    resetScroll?: boolean;
    search: StandingRouteSearch;
  }) => Promise<void>;
  search: StandingRouteSearch;
}) => {
  const navigation = React.useMemo<DataTableNavigation>(
    () => ({
      navigate: async nextSearch => {
        await navigate({
          resetScroll: false,
          search: standingSearchFrom(nextSearch),
        });
      },
      searchParams: standingSearchParams(search),
    }),
    [navigate, search],
  );

  return (
    <RouteMessages namespaces={STANDING_NAMESPACES}>
      <DataTableNavigationProvider value={navigation}>
        <AccountStatusContent params={standingHistoryParams(search)} />
      </DataTableNavigationProvider>
    </RouteMessages>
  );
};

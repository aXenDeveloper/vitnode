import React from "react";

import type { DataTableNavigation } from "@/components/table/navigation";

import { DataTableNavigationProvider } from "@/components/table/navigation";
import { ModcpMemberContent } from "@/views/moderation/warnings/modcp-member-content";
import { ModcpWarningsContent } from "@/views/moderation/warnings/modcp-warnings-content";

import type { ModcpRouteData } from "./route";
import type { ModcpWarningsRouteSearch } from "./warnings-route";

import { RouteMessages } from "../i18n/route-messages";
import { MODCP_NAMESPACES } from "./namespaces";
import {
  modcpWarningsFilter,
  modcpWarningsSearchFrom,
  modcpWarningsSearchParams,
} from "./warnings-route";

export const ModcpWarningsRouteContent = ({
  description,
  navigate,
  search,
  title,
}: ModcpRouteData & {
  navigate: (options: {
    resetScroll?: boolean;
    search: ModcpWarningsRouteSearch;
  }) => Promise<void>;
  search: ModcpWarningsRouteSearch;
}) => {
  const navigation = React.useMemo<DataTableNavigation>(
    () => ({
      navigate: async nextSearch => {
        await navigate({
          resetScroll: false,
          search: modcpWarningsSearchFrom(nextSearch),
        });
      },
      searchParams: modcpWarningsSearchParams(search),
    }),
    [navigate, search],
  );

  return (
    <RouteMessages namespaces={MODCP_NAMESPACES}>
      <DataTableNavigationProvider value={navigation}>
        <ModcpWarningsContent
          description={description}
          filter={modcpWarningsFilter(search)}
          title={title}
        />
      </DataTableNavigationProvider>
    </RouteMessages>
  );
};

export const ModcpMemberRouteContent = ({ id }: { id: number }) => (
  <RouteMessages namespaces={MODCP_NAMESPACES}>
    <ModcpMemberContent userId={id} />
  </RouteMessages>
);

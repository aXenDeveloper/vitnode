"use client";

import type { SearchFeedLinkComponent } from "@/views/search/search-feed-content";

import { HeaderContent } from "@/components/ui/header-content";
import { SearchFeedContent } from "@/views/search/search-feed-content";

import type { DiscoverRouteData } from "./discover-route";

import { useLocale } from "../i18n/locale";
import { RouteMessages } from "../i18n/route-messages";
import { discoverFeedQueryOptions } from "./discover";
import { DISCOVER_NAMESPACES } from "./discover-route";

export const DiscoverRouteContent = ({
  description,
  LinkComponent,
  title,
}: DiscoverRouteData & { LinkComponent: SearchFeedLinkComponent }) => {
  const locale = useLocale();

  return (
    <RouteMessages namespaces={DISCOVER_NAMESPACES}>
      <div className="container mx-auto flex max-w-3xl flex-col gap-6 p-4">
        <HeaderContent desc={description} h1={title} />

        <SearchFeedContent
          LinkComponent={LinkComponent}
          queryOptions={discoverFeedQueryOptions({ locale })}
          variant="timeline"
        />
      </div>
    </RouteMessages>
  );
};

"use client";

import type { SearchFeedLinkComponent } from "@/views/search/search-feed-content";

import { HeaderContent } from "@/components/ui/header-content";
import { SearchControlsContent } from "@/views/search/search-controls-content";

import type { SearchRouteData } from "./search-route";

import { useLocale } from "../i18n/locale";
import { RouteMessages } from "../i18n/route-messages";
import { feedQueryOptions } from "./feed";
import { SEARCH_NAMESPACES } from "./search-route";

export const SearchRouteContent = ({
  description,
  LinkComponent,
  params,
  title,
}: SearchRouteData & { LinkComponent: SearchFeedLinkComponent }) => {
  const locale = useLocale();

  return (
    <RouteMessages namespaces={SEARCH_NAMESPACES}>
      <div className="container mx-auto flex max-w-3xl flex-col gap-6 p-4">
        <HeaderContent desc={description} h1={title} />

        <SearchControlsContent
          defaultParams={params}
          feedQuery={feedParams =>
            feedQueryOptions({ locale, params: feedParams })
          }
          key={params.search ?? ""}
          LinkComponent={LinkComponent}
          variant="timeline"
        />
      </div>
    </RouteMessages>
  );
};

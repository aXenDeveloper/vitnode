import { PageTitle } from "@/components/ui/page-title";
import { SearchControlsContent } from "@/views/search/search-controls-content";

import type { SearchRouteData } from "./search-route";

import { useLocale } from "../i18n/locale";
import { RouteMessages } from "../i18n/route-messages";
import { feedQueryOptions } from "./feed";
import { SEARCH_NAMESPACES } from "./search-route";

export const SearchRouteContent = ({
  description,
  params,
  title,
}: SearchRouteData) => {
  const locale = useLocale();

  return (
    <RouteMessages namespaces={SEARCH_NAMESPACES}>
      <div className="container mx-auto flex max-w-3xl flex-col gap-6 p-4">
        <PageTitle desc={description} h1={title} />

        <SearchControlsContent
          defaultParams={params}
          feedQuery={feedParams =>
            feedQueryOptions({ locale, params: feedParams })
          }
          key={params.search ?? ""}
          variant="timeline"
        />
      </div>
    </RouteMessages>
  );
};

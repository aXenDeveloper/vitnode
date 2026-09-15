import type { PluginRoutePageProps } from "@/routing";

import type { MyFilesRouteData } from "../tanstack/files/route";
import type { UncheckedMyFilesSearch } from "../tanstack/files/route-search";

import { loadMyFilesRoute } from "../tanstack/files/route";
import { myFilesRouteParams } from "../tanstack/files/route-search";
import { MyFilesRouteContent } from "../tanstack/files/screen";
import { defineAuthenticatedRoute } from "../tanstack/plugin-routes";

const MyFilesPage = ({
  loaderData,
  navigate,
  search,
}: PluginRoutePageProps<MyFilesRouteData, UncheckedMyFilesSearch>) => (
  <MyFilesRouteContent {...loaderData} navigate={navigate} search={search} />
);

export const route = defineAuthenticatedRoute<
  MyFilesRouteData,
  UncheckedMyFilesSearch
>({
  // `head` after `load`, always.
  load: async ({ context, search, t }) =>
    await loadMyFilesRoute({
      ...context,
      params: myFilesRouteParams(search),
      t,
    }),
  head: ({ loaderData }) => ({ robots: "noindex, nofollow", ...loaderData }),
});

export default MyFilesPage;

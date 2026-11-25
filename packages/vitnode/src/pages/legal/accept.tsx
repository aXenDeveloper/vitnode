import type { PluginRoutePageProps } from "@/routing";
import type {
  LegalAcceptRouteData,
  LegalAcceptSearch,
} from "@/tanstack/legal/accept-route";

import { loadLegalAcceptRoute } from "@/tanstack/legal/accept-route";
import { LegalAcceptRouteContent } from "@/tanstack/legal/accept-screen";
import { defineAuthenticatedRoute } from "@/tanstack/plugin-routes";

const LegalAcceptPage = ({
  loaderData,
  search,
}: PluginRoutePageProps<LegalAcceptRouteData, LegalAcceptSearch>) => (
  <LegalAcceptRouteContent {...loaderData} returnTo={search.returnTo} />
);

export const route = defineAuthenticatedRoute<
  LegalAcceptRouteData,
  LegalAcceptSearch
>({
  load: async ({ context, search, t }) =>
    await loadLegalAcceptRoute({ ...context, returnTo: search.returnTo, t }),
  head: ({ loaderData }) => ({
    robots: "noindex, nofollow",
    title: loaderData?.title,
  }),
});

export default LegalAcceptPage;

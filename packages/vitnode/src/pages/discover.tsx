import type { PluginRoutePageProps } from "@/routing";

import type { DiscoverRouteData } from "../tanstack/search/discover-route";

import { defineRoute } from "../tanstack/plugin-routes";
import { loadDiscoverRoute } from "../tanstack/search/discover-route";
import { DiscoverRouteContent } from "../tanstack/search/discover-screen";

const DiscoverPage = ({
  loaderData,
}: PluginRoutePageProps<DiscoverRouteData>) => (
  <DiscoverRouteContent {...loaderData} />
);

export const route = defineRoute({
  // `head` after `load`, always: `loaderData` is inferred from `load`, and
  // TypeScript reads an object literal's members in order.
  load: async ({ context, t }) => await loadDiscoverRoute({ ...context, t }),
  head: ({ loaderData }) => ({ robots: "index, follow", ...loaderData }),
});

export default DiscoverPage;

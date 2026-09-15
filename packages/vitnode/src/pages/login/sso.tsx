import type { PluginRoutePageProps } from "@/routing";
import type { SsoCallbackSearch } from "@/tanstack/auth/route-search";

import { loadSsoCallbackRoute } from "@/tanstack/auth/sso-route";
import { SsoCallbackRouteContent } from "@/tanstack/auth/sso-screen";
import { ErrorActions } from "@/tanstack/layout/error-actions";
import { defineRoute } from "@/tanstack/plugin-routes";

const SsoCallbackPage = ({
  params,
  search,
}: PluginRoutePageProps<undefined, SsoCallbackSearch>) => (
  <SsoCallbackRouteContent
    errorActions={<ErrorActions />}
    providerId={params.providerId}
    search={search}
  />
);

export const route = defineRoute<undefined, SsoCallbackSearch>({
  load: async ({ context }) => {
    await loadSsoCallbackRoute(context);
  },
});

export default SsoCallbackPage;

import type { PluginRoutePageProps } from "@/routing";
import type { AdminSignInSearch } from "@/tanstack/admin/sign-in-search";

import { AdminSignInRouteContent } from "@/tanstack/admin/sign-in-screen";
import { loadAuthCard } from "@/tanstack/auth/login-route";
import { defineRoute } from "@/tanstack/plugin-routes";

const AdminSignInPage = ({
  search,
}: PluginRoutePageProps<undefined, AdminSignInSearch>) => (
  <AdminSignInRouteContent returnTo={search.returnTo} />
);

export const route = defineRoute<undefined, AdminSignInSearch>({
  load: async ({ context }) => {
    await loadAuthCard(context);
  },
  head: ({ t }) => ({ title: t("core.global.login") }),
});

export default AdminSignInPage;

import type { PluginRoutePageProps } from "@/routing";
import type { AdminSignInSearch } from "@/tanstack/admin/sign-in-search";

import { AdminSignInRouteContent } from "@/tanstack/admin/sign-in-screen";
import { useAppNavigate } from "@/tanstack/auth/navigation";
import { defineRoute } from "@/tanstack/plugin-routes";

const AdminSignInPage = ({
  search,
}: PluginRoutePageProps<undefined, AdminSignInSearch>) => (
  <AdminSignInRouteContent
    navigate={useAppNavigate()}
    returnTo={search.returnTo}
  />
);

export const route = defineRoute<undefined, AdminSignInSearch>({
  head: ({ t }) => ({ title: t("core.global.login") }),
});

export default AdminSignInPage;

import type { PluginRoutePageProps } from "@/routing";
import type { LoginSearch } from "@/tanstack/auth/route-search";

import { loadLoginRoute } from "@/tanstack/auth/login-route";
import { LoginRouteContent } from "@/tanstack/auth/login-screen";
import { useAppNavigate } from "@/tanstack/auth/navigation";
import { defineRoute } from "@/tanstack/plugin-routes";

const LoginPage = ({
  search,
}: PluginRoutePageProps<undefined, LoginSearch>) => (
  <LoginRouteContent navigate={useAppNavigate()} returnTo={search.returnTo} />
);

export const route = defineRoute<undefined, LoginSearch>({
  load: async ({ context }) => {
    await loadLoginRoute(context);
  },
  head: ({ t }) => ({ title: t("core.global.login") }),
});

export default LoginPage;

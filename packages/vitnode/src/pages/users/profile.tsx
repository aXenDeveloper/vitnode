import type { PluginRoutePageProps } from "@/routing";
import type { ProfileRouteData } from "@/tanstack/profile/route";
import type { ProfileRouteSearch } from "@/tanstack/profile/route-search";

import { ErrorActions } from "@/tanstack/layout/error-actions";
import { defineRoute } from "@/tanstack/plugin-routes";
import { ProfileNotFound } from "@/tanstack/profile/not-found";
import { loadProfileRoute } from "@/tanstack/profile/route";
import { ProfileRouteContent } from "@/tanstack/profile/screen";

const ProfilePage = ({
  loaderData,
  search,
}: PluginRoutePageProps<ProfileRouteData, ProfileRouteSearch>) => (
  <ProfileRouteContent nameCode={loaderData.nameCode} search={search} />
);

export const route = defineRoute<ProfileRouteData, ProfileRouteSearch>({
  // `head` after `load`, always.
  load: async ({ context, params, search, t }) =>
    await loadProfileRoute({
      ...context,
      nameCode: params.nameCode,
      search,
      t,
    }),
  head: ({ loaderData }) => ({ robots: "index, follow", ...loaderData }),

  notFound: function ProfileRouteNotFound() {
    return <ProfileNotFound actions={<ErrorActions />} />;
  },
});

export default ProfilePage;

import type { PluginRoutePageProps } from "@/routing";
import type { ProfileRouteData } from "@/tanstack/profile/route";

import { ErrorActions } from "@/tanstack/layout/error-actions";
import { defineRoute } from "@/tanstack/plugin-routes";
import { ProfileNotFound } from "@/tanstack/profile/not-found";
import { loadProfileRoute } from "@/tanstack/profile/route";
import { ProfileRouteContent } from "@/tanstack/profile/screen";

const ProfilePage = ({
  loaderData,
}: PluginRoutePageProps<ProfileRouteData>) => (
  <ProfileRouteContent nameCode={loaderData.nameCode} />
);

export const route = defineRoute<ProfileRouteData>({
  // `head` after `load`, always.
  load: async ({ context, params, t }) =>
    await loadProfileRoute({ ...context, nameCode: params.nameCode, t }),
  head: ({ loaderData }) => ({ robots: "index, follow", ...loaderData }),

  notFound: function ProfileRouteNotFound() {
    return <ProfileNotFound actions={<ErrorActions />} />;
  },
});

export default ProfilePage;

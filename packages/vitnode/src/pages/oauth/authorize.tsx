import type { AvatarUser } from "@/components/avatar";
import type { PluginRoutePageProps } from "@/routing";
import type { OAuthAuthorizeSearch } from "@/views/auth/oauth/authorize-search";

import { OAuthAuthorizeRouteContent } from "@/tanstack/oauth/screen";
import { defineAuthenticatedRoute } from "@/tanstack/plugin-routes";
import { oauthAuthorizeQueryOptions } from "@/views/auth/oauth/authorize-query";

interface OAuthAuthorizeData {
  user: AvatarUser;
  userId: number;
}

const OAuthAuthorizePage = ({
  loaderData,
  search,
}: PluginRoutePageProps<OAuthAuthorizeData, OAuthAuthorizeSearch>) => (
  <OAuthAuthorizeRouteContent
    search={search}
    user={loaderData.user}
    userId={loaderData.userId}
  />
);

export const route = defineAuthenticatedRoute<
  OAuthAuthorizeData,
  OAuthAuthorizeSearch
>({
  load: async ({ context, search }) => {
    const { avatarColor, avatarUrl, id, name, nameCode } = context.auth.user;

    // Warmed, not awaited for its outcome: a failed check renders the page's
    // own retry state instead of the route's error screen.
    await context.queryClient
      .query({
        ...oauthAuthorizeQueryOptions({ search, userId: id }),
        staleTime: "static",
      })
      .catch(() => undefined);

    return { user: { avatarColor, avatarUrl, name, nameCode }, userId: id };
  },
  head: ({ t }) => ({
    robots: "noindex, nofollow",
    title: t("core.auth.oauth.title"),
  }),
});

export default OAuthAuthorizePage;

import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { AvatarUser } from "@/components/avatar";
import type { OAuthAuthorizeCheck } from "@/views/auth/oauth/authorize-query";
import type { OAuthAuthorizeSearch } from "@/views/auth/oauth/authorize-search";

import { OAuthAuthorizeSkeleton } from "@/views/auth/oauth/authorize-card";
import {
  CONNECTED_APPS_HREF,
  type OAuthAnswer,
  OAuthAuthorizeContent,
} from "@/views/auth/oauth/authorize-content";
import {
  answerOAuthAuthorize,
  oauthAuthorizeQueryOptions,
} from "@/views/auth/oauth/authorize-query";
import { OAuthAuthorizeStateContent } from "@/views/auth/oauth/authorize-states";

const connectedAppsLink = (chunks: React.ReactNode) => (
  <Link
    className="text-foreground font-medium underline-offset-4 hover:underline"
    rel="noopener"
    target="_blank"
    to={CONNECTED_APPS_HREF}
  >
    {chunks}
  </Link>
);

export interface OAuthAuthorizeRouteProps {
  search: OAuthAuthorizeSearch;
  user: AvatarUser;
  userId: number;
}

/**
 * The MCP consent screen: which client asks, where it sends the browser back,
 * and which scopes it may have. The answer leaves this app with a full-page
 * navigation to the client's redirect URI.
 */
export const OAuthAuthorizeRouteContent = ({
  search,
  user,
  userId,
}: OAuthAuthorizeRouteProps) => {
  const t = useTranslations("core.auth.oauth");
  const query = useQuery(oauthAuthorizeQueryOptions({ search, userId }));
  // An answer the API refused replaces the request it was about.
  const [refused, setRefused] = React.useState<Exclude<
    OAuthAuthorizeCheck,
    { status: "ok" }
  > | null>(null);

  const onAnswer: OAuthAnswer = async ({ approve, scopes }) => {
    const result = await answerOAuthAuthorize({ approve, scopes, search });

    if ("redirectTo" in result) {
      window.location.assign(result.redirectTo);

      return true;
    }
    if ("check" in result) {
      setRefused(result.check);

      return false;
    }

    toast.error(t("error.title"), { description: t("error.desc") });

    return false;
  };

  if (query.isPending) return <OAuthAuthorizeSkeleton />;

  if (query.isError) {
    return (
      <OAuthAuthorizeStateContent
        isRetrying={query.isFetching}
        onRetry={() => void query.refetch()}
        state="load_error"
      />
    );
  }

  const check = refused ?? query.data;

  if (check.status !== "ok") {
    return <OAuthAuthorizeStateContent state={check.status} />;
  }

  return (
    <OAuthAuthorizeContent
      connectedAppsLink={connectedAppsLink}
      onAnswer={onAnswer}
      request={check.request}
      user={user}
    />
  );
};

import { useRouter } from "@tanstack/react-router";

import { SSOCallbackContent } from "@/views/auth/sso/callback/sso-callback-content";
import { useSSOCallback } from "@/views/auth/sso/callback/use-sso-callback";

import { RouteMessages } from "../i18n/route-messages";
import { useCompleteSsoAction, useLinkSsoAction } from "./actions";
import { parseSsoCallback } from "./contract";
import { ssoProvidersOf, useMiddlewareConfigQuery } from "./middleware-config";
import { parseInternalDestination, postAuthDestination } from "./redirects";
import { SSO_CALLBACK_NAMESPACES } from "./sso-route";

export interface SsoCallbackRouteProps {
  /** The "go back" / "go home" pair a host renders on a dead-end screen. */
  errorActions: React.ReactNode;
  providerId: string;
  search: { code?: string; error?: string; state?: string };
}

export const SsoCallbackRouteContent = ({
  errorActions,
  providerId,
  search,
}: SsoCallbackRouteProps) => {
  const router = useRouter();
  const { data: config } = useMiddlewareConfigQuery();

  const parsed = parseSsoCallback({ providerId, query: search });
  const completeSso = useCompleteSsoAction(parsed.ok ? parsed.params : null);
  // The front page, through the same rule the login form uses. There is no
  // `returnTo` to honour here and there must not be: this URL is built by the
  // provider from what the API registered with it, so anything in its query
  // came back from another origin.
  const onSignedIn = () => {
    void router.navigate(
      parseInternalDestination(postAuthDestination(undefined)),
    );
  };
  const linkSso = useLinkSsoAction({ onSignedIn, providerId });

  const state = useSSOCallback({
    code: parsed.ok ? parsed.params.code : "",
    oauthError: search.error,
    onCallback: completeSso,
    onSignedIn,
    providerId,
  });

  return (
    <RouteMessages namespaces={SSO_CALLBACK_NAMESPACES}>
      <SSOCallbackContent
        errorActions={errorActions}
        onLink={linkSso}
        providerId={providerId}
        providers={ssoProvidersOf(config)}
        showResetPassword={config.isEmail}
        state={state}
      />
    </RouteMessages>
  );
};

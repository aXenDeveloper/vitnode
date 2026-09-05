"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { SSOCallbackContent } from "@/views/auth/sso/callback/sso-callback-content";
import { useSSOCallback } from "@/views/auth/sso/callback/use-sso-callback";

import { RouteMessages } from "../i18n/route-messages";
import { useCompleteSsoAction } from "./actions";
import { parseSsoCallback } from "./contract";
import {
  middlewareConfigQueryOptions,
  ssoProvidersOf,
} from "./middleware-config";
import { parseInternalDestination, postAuthDestination } from "./redirects";
import { SSO_CALLBACK_NAMESPACES } from "./sso-route";

export interface SsoCallbackRouteProps {
  /** The "go back" / "go home" pair a host renders on a dead-end screen. */
  errorActions: React.ReactNode;
  LinkComponent: AuthLinkComponent;
  providerId: string;
  search: { code?: string; error?: string; state?: string };
}

export const SsoCallbackRouteContent = ({
  errorActions,
  LinkComponent,
  providerId,
  search,
}: SsoCallbackRouteProps) => {
  const router = useRouter();
  const { data: config } = useSuspenseQuery(middlewareConfigQueryOptions());

  const parsed = parseSsoCallback({ providerId, query: search });
  const completeSso = useCompleteSsoAction(parsed.ok ? parsed.params : null);

  const state = useSSOCallback({
    code: parsed.ok ? parsed.params.code : "",
    oauthError: search.error,
    onCallback: completeSso,
    // The front page, through the same rule the login form uses. There is no
    // `returnTo` to honour here and there must not be: this URL is built by the
    // provider from what the API registered with it, so anything in its query
    // came back from another origin.
    onSignedIn: () => {
      void router.navigate(
        parseInternalDestination(postAuthDestination(undefined)),
      );
    },
    providerId,
  });

  return (
    <RouteMessages namespaces={SSO_CALLBACK_NAMESPACES}>
      <SSOCallbackContent
        errorActions={errorActions}
        LinkComponent={LinkComponent}
        providerId={providerId}
        providers={ssoProvidersOf(config)}
        state={state}
      />
    </RouteMessages>
  );
};

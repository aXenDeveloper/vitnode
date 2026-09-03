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

/**
 * The SSO callback, as everything below a route file's `component`.
 *
 * The exchange itself is unchanged and stays on the server: the API verifies
 * `state` against the cookie it minted, deletes it, trades the `code` with the
 * provider and mints the session. Nothing here re-implements or re-checks any of
 * that.
 */
export const SsoCallbackRouteContent = ({
  errorActions,
  LinkComponent,
  providerId,
  search,
}: SsoCallbackRouteProps) => {
  const router = useRouter();
  const { data: config } = useSuspenseQuery(middlewareConfigQueryOptions());

  /**
   * The callback URL, judged before any of it is sent on: the provider id has to
   * be a slug, `code` and `state` have to be present and bounded, and an `error`
   * is classified rather than carried. A malformed callback never reaches the
   * API.
   */
  const parsed = parseSsoCallback({ providerId, query: search });
  const completeSso = useCompleteSsoAction(parsed.ok ? parsed.params : null);

  /**
   * The exchange, run once, by the shared hook both frameworks use.
   *
   * `oauthError` is the raw `error` parameter, which is what the hook's own rule
   * is written against: `access_denied` disables the query outright - there is
   * nothing to exchange when the visitor said no - and anything else lets it run
   * and fail, which is the screen a provider error should produce anyway. The
   * exchange itself refuses to call the API unless `parseSsoCallback` produced
   * parameters, so neither a malformed callback nor a provider error costs a
   * request.
   */
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

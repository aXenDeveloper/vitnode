import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslations } from "use-intl";

import { Loader } from "@/components/ui/loader";
import { ssoConnectionIntentOfState } from "@/lib/sso-profile";
import { ssoConnectionCallbackTarget } from "@/views/auth/settings/sso/connection-callback";
import { useSsoConnectionNotice } from "@/views/auth/settings/sso/connection-notice";
import { completeSsoConnectionInBrowser } from "@/views/auth/settings/sso/sso-connections-mutations";
import { SSO_CONNECTIONS_IDENTITY_ROOT } from "@/views/auth/settings/sso/sso-connections-query";
import { SSOCallbackContent } from "@/views/auth/sso/callback/sso-callback-content";
import { useSSOCallback } from "@/views/auth/sso/callback/use-sso-callback";

import { RouteMessages } from "../i18n/route-messages";
import { ssoSettingsHref } from "../sso-connections/route-search";
import { useCompleteSsoAction, useLinkSsoAction } from "./actions";
import { parseSsoCallback } from "./contract";
import {
  authMethodsOf,
  ssoProvidersOf,
  useMiddlewareConfigQuery,
} from "./middleware-config";
import { parseInternalDestination, postAuthDestination } from "./redirects";
import { invalidateSession } from "./session-query";
import { SSO_CALLBACK_NAMESPACES } from "./sso-route";

export interface SsoCallbackRouteProps {
  /** The "go back" / "go home" pair a host renders on a dead-end screen. */
  errorActions: React.ReactNode;
  providerId: string;
  search: { code?: string; error?: string; state?: string };
}

const SsoConnectionCallbackPending = ({
  providerName,
}: {
  providerName: string;
}) => {
  const t = useTranslations("core.auth.sso.connection");

  return (
    <div
      aria-live="polite"
      className="container mx-auto flex flex-col items-center justify-center gap-4 p-4"
      role="status"
    >
      <Loader />
      <p className="text-muted-foreground text-sm leading-relaxed">
        {t("pending", { provider: providerName })}
      </p>
    </div>
  );
};

const SSO_CONNECTION_CALLBACK_NAMESPACES = [
  ...SSO_CALLBACK_NAMESPACES,
  "core.auth.settings",
] as const;

const SsoConnectionCallbackRunner = ({
  providerId,
  providerName,
  search,
}: Pick<SsoCallbackRouteProps, "providerId" | "search"> & {
  providerName: string;
}) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const notify = useSsoConnectionNotice(providerName);

  useQuery({
    queryFn: async () => {
      const target = await ssoConnectionCallbackTarget({
        complete: completeSsoConnectionInBrowser,
        providerId,
        search,
      });

      queryClient.removeQueries({ queryKey: SSO_CONNECTIONS_IDENTITY_ROOT });
      if (target.synced) await invalidateSession(queryClient);
      notify(target);
      await router.navigate({
        ...parseInternalDestination(ssoSettingsHref({ import: target.import })),
        replace: true,
      });

      return target;
    },
    queryKey: [
      "core.auth.sso.connection.callback",
      providerId,
      search.code,
      search.state,
    ],
    retry: false,
    staleTime: Infinity,
  });

  return <SsoConnectionCallbackPending providerName={providerName} />;
};

const SsoConnectionCallbackRoute = ({
  providerId,
  search,
}: Pick<SsoCallbackRouteProps, "providerId" | "search">) => {
  const { data: config } = useMiddlewareConfigQuery();
  const providerName =
    ssoProvidersOf(config).find(one => one.id === providerId)?.name ??
    providerId;

  return (
    <RouteMessages namespaces={SSO_CONNECTION_CALLBACK_NAMESPACES}>
      <SsoConnectionCallbackRunner
        providerId={providerId}
        providerName={providerName}
        search={search}
      />
    </RouteMessages>
  );
};

export const SsoCallbackRouteContent = (props: SsoCallbackRouteProps) =>
  ssoConnectionIntentOfState(props.search.state) ? (
    <SsoConnectionCallbackRoute
      providerId={props.providerId}
      search={props.search}
    />
  ) : (
    <SsoSignInCallbackRoute {...props} />
  );

const SsoSignInCallbackRoute = ({
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
        showResetPassword={authMethodsOf(config).resetPassword}
        state={state}
      />
    </RouteMessages>
  );
};

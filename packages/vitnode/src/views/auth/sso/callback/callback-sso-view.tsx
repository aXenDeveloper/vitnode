import { I18nProvider } from "@/components/i18n-provider";
import { getMiddlewareApi } from "@/lib/api/get-middleware-api";

import { normalizeSSOProviders } from "../providers";
import { ClientCallbackSSO } from "./client/client";

/**
 * The OAuth callback page for Next.js.
 *
 * A Server Component for one reason - reading which adapters this deployment
 * registered, so the screens can name the provider rather than echo the id in
 * the URL. Everything after that is the shared callback, mounted under the
 * request-scoped message provider.
 */
export const CallbackSSOView = async ({
  providerId,
  searchParams: { code, error, state },
}: {
  providerId: string;
  searchParams: Record<string, string>;
}) => {
  const { sso } = await getMiddlewareApi();

  return (
    <I18nProvider namespaces={["core.auth.sso"]}>
      <ClientCallbackSSO
        code={code}
        oauthError={error}
        oauthState={state}
        providerId={providerId}
        providers={normalizeSSOProviders(sso)}
      />
    </I18nProvider>
  );
};

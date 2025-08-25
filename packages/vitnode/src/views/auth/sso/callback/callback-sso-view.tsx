import { getTranslations } from "next-intl/server";

import { I18nProvider } from "@/components/i18n-provider";
import { ErrorView } from "@/views/error/error-view";

import { getMiddlewareApi } from "../../../../lib/api/get-middleware-api";
import { ClientCallbackSSO } from "./client/client";

export const CallbackSSOView = async ({
  providerId,
  searchParams: { code, error, state },
}: {
  providerId: string;
  searchParams: Record<string, string>;
}) => {
  const [t, { sso }] = await Promise.all([
    getTranslations("core.auth.sso"),
    getMiddlewareApi(),
  ]);

  if (error === "access_denied") {
    return <ErrorView code={403} customDescription={t("access_denied")} />;
  }

  return (
    <I18nProvider namespaces={["core.auth.sso"]}>
      {error === "access_denied" ? (
        <ErrorView code={403} customDescription={t("access_denied")} />
      ) : (
        <ClientCallbackSSO
          code={code}
          providerId={providerId}
          sso={sso}
          state={state}
        />
      )}
    </I18nProvider>
  );
};

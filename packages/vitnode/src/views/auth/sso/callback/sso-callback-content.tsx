"use client";

import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { ErrorContent } from "@/views/error/error-content";

import type { AuthLinkComponent } from "../../auth-link";
import type { SSOProvider } from "../providers";
import type { SSOCallbackState } from "./use-sso-callback";

import { AUTH_HREF } from "../../auth-link";

export const SSOCallbackContent = ({
  LinkComponent,
  errorActions,
  providerId,
  providers,
  signInHref = AUTH_HREF.signIn,
  state,
}: {
  errorActions?: React.ReactNode;
  LinkComponent: AuthLinkComponent;
  providerId: string;
  providers: readonly SSOProvider[];
  signInHref?: string;
  state: SSOCallbackState;
}) => {
  const t = useTranslations("core.auth.sso");
  const tGlobal = useTranslations("core.global");
  const provider = providers.find(one => one.id === providerId);
  // The provider's display name, falling back to the id in the URL: a callback
  // can arrive for an adapter that was removed from the deployment, and "you
  // cannot sign in with google" still reads better than an empty sentence.
  const providerName = () => (
    <span className="font-semibold">{provider?.name ?? providerId}</span>
  );

  if (state === "access_denied") {
    return (
      <ErrorContent
        actions={errorActions}
        code={403}
        description={t("access_denied")}
        title={tGlobal("errors.403.title")}
      />
    );
  }

  if (state === "email_exists") {
    return (
      <ErrorContent
        actions={
          <Button
            nativeButton={false}
            render={<LinkComponent href={signInHref} />}
            size="lg"
          >
            {t("email_exists.sign_in")}
          </Button>
        }
        code={409}
        description={t.rich("email_exists.desc", { provider: providerName })}
        title={t.rich("email_exists.title", { provider: providerName })}
      />
    );
  }

  if (state === "error") {
    return (
      <ErrorContent
        actions={errorActions}
        code={500}
        description={tGlobal("errors.500.desc")}
        title={tGlobal("errors.500.title")}
      />
    );
  }

  return (
    <div className="container mx-auto flex items-center justify-center p-4">
      <Loader />
    </div>
  );
};

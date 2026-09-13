import { Link } from "@tanstack/react-router";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { Card, CardDescription } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { ErrorContent } from "@/views/error/error-content";

import type { SSOLinkSubmit } from "../link/sso-link-form-content";
import type { SSOProvider } from "../providers";
import type { SSOCallbackState } from "./use-sso-callback";

import { AUTH_HREF } from "../../auth-link";
import { SSOLinkFormContent } from "../link/sso-link-form-content";

export const SSOCallbackContent = ({
  errorActions,
  onLink,
  providerId,
  providers,
  resetPasswordHref = AUTH_HREF.resetPassword,
  showResetPassword = false,
  signInHref = AUTH_HREF.signIn,
  state,
}: {
  errorActions?: React.ReactNode;
  onLink: SSOLinkSubmit;
  providerId: string;
  providers: readonly SSOProvider[];
  resetPasswordHref?: string;
  showResetPassword?: boolean;
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

  if (state.kind === "access_denied") {
    return (
      <ErrorContent
        actions={errorActions}
        code={403}
        description={t("access_denied")}
        title={tGlobal("errors.403.title")}
      />
    );
  }

  if (state.kind === "email_exists" && state.offer) {
    return (
      <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16 md:min-h-[calc(100vh-4rem)]">
        <Card className="bg-muted gap-0 p-0">
          <div className="bg-card rounded-xl p-6">
            <div className="mb-10 flex flex-col gap-2 text-center">
              <h1 className="text-2xl leading-none font-semibold tracking-tight text-balance">
                {t.rich("link.title", { provider: providerName })}
              </h1>
              <CardDescription className="text-pretty">
                {t.rich("link.desc", { provider: providerName })}
              </CardDescription>
            </div>

            <SSOLinkFormContent
              offer={state.offer}
              onLink={onLink}
              providerName={providerName}
              resetPasswordHref={resetPasswordHref}
              showResetPassword={showResetPassword}
              signInHref={signInHref}
            />
          </div>

          <div className="text-accent-foreground p-6 text-center text-sm">
            {t.rich("link.other_account", {
              link: text => (
                <Link className="text-primary font-semibold" to={signInHref}>
                  {text}
                </Link>
              ),
            })}
          </div>
        </Card>
      </div>
    );
  }

  if (state.kind === "email_exists") {
    return (
      <ErrorContent
        actions={
          <Button
            nativeButton={false}
            render={<Link to={signInHref} />}
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

  if (state.kind === "error") {
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

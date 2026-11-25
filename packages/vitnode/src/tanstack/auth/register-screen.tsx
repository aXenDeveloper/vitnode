import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useLocale, useTranslations } from "use-intl";

import { SignUpFormContent } from "@/views/auth/sign-up/form/sign-up-form-content";
import { SignUpContent } from "@/views/auth/sign-up/sign-up-content";
import { SSOButtonsContent } from "@/views/auth/sso/buttons/sso-buttons-content";
import { legalLinksQueryOptions } from "@/views/legal/legal-query";

import { RouteMessages } from "../i18n/route-messages";
import { startSsoAction, useSignUpAction } from "./actions";
import { authMethodsOf, useMiddlewareConfigQuery } from "./middleware-config";
import { postAuthDestination } from "./redirects";
import { REGISTER_NAMESPACES } from "./register-route";

const legalLinkClass = "text-primary underline-offset-4 hover:underline";

/** First-time SSO members see the Privacy Policy before their account exists. */
const LegalSsoNotice = () => {
  const t = useTranslations("core.legal.sso");

  return (
    <p className="text-muted-foreground text-center text-sm leading-relaxed text-pretty">
      {t.rich("privacy", {
        privacy: text => (
          <Link className={legalLinkClass} target="_blank" to="/privacy">
            {text}
          </Link>
        ),
        terms: text => (
          <Link className={legalLinkClass} target="_blank" to="/terms">
            {text}
          </Link>
        ),
      })}
    </p>
  );
};

export const RegisterRouteContent = () => {
  const { data: config } = useMiddlewareConfigQuery();
  const methods = authMethodsOf(config);
  const signUp = useSignUpAction({
    destination: () => postAuthDestination(undefined),
  });
  const locale = useLocale();
  const legal = useQuery(legalLinksQueryOptions(locale));
  const terms = legal.data?.terms;

  return (
    <RouteMessages namespaces={REGISTER_NAMESPACES}>
      <SignUpContent
        form={
          methods.password ? (
            <SignUpFormContent
              captcha={config.captcha}
              isEmail={config.isEmail}
              onSignUp={signUp}
              onTermsChanged={async () => {
                await legal.refetch();
              }}
              privacy={legal.data?.privacy}
              terms={
                terms
                  ? {
                      locale,
                      title: terms.title,
                      version: terms.version,
                      versionId: terms.id,
                    }
                  : null
              }
            />
          ) : undefined
        }
        isUnavailable={!methods.signUp}
        sso={
          methods.sso.length > 0 ? (
            <div className="flex flex-col gap-3">
              <SSOButtonsContent
                layout="stack"
                onSelectProvider={startSsoAction}
                providers={methods.sso}
              />
              {legal.data?.privacy || terms ? <LegalSsoNotice /> : null}
            </div>
          ) : undefined
        }
      />
    </RouteMessages>
  );
};

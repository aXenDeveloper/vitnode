import { Link } from "@tanstack/react-router";
import { useTranslations } from "use-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { AuthCard } from "../auth-card";
import { AUTH_HREF } from "../auth-link";

export const SignInContent = ({
  form,
  isUnavailable = false,
  passkey,
  showSignUp = true,
  signUpHref = AUTH_HREF.signUp,
  sso,
}: {
  form?: React.ReactNode;
  isUnavailable?: boolean;
  passkey?: React.ReactNode;
  showSignUp?: boolean;
  signUpHref?: string;
  sso?: React.ReactNode;
}) => {
  const t = useTranslations("core.auth.sign_in");
  const tGlobal = useTranslations("core.global");

  return (
    <AuthCard
      alternatives={
        sso || passkey ? (
          <>
            {sso}
            {passkey}
          </>
        ) : undefined
      }
      description={t("desc")}
      footer={
        showSignUp
          ? t.rich("do_not_have_account", {
              link: text => (
                <Link className="text-primary font-semibold" to={signUpHref}>
                  {text}
                </Link>
              ),
            })
          : undefined
      }
      form={form}
      notice={
        isUnavailable ? (
          <Alert>
            <AlertTitle>{t("unavailable.title")}</AlertTitle>
            <AlertDescription>{t("unavailable.desc")}</AlertDescription>
          </Alert>
        ) : undefined
      }
      title={tGlobal("login")}
    />
  );
};

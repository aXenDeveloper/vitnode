import { Link } from "@tanstack/react-router";
import { useTranslations } from "use-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { AuthCard } from "../auth-card";
import { AUTH_HREF } from "../auth-link";
import { WrapperSignUp } from "./wrapper";

export const SignUpContent = ({
  form,
  isUnavailable = false,
  signInHref = AUTH_HREF.signIn,
  sso,
}: {
  form?: React.ReactNode;
  isUnavailable?: boolean;
  signInHref?: string;
  sso?: React.ReactNode;
}) => {
  const t = useTranslations("core.auth.sign_up");
  const tGlobal = useTranslations("core.global");

  return (
    <WrapperSignUp>
      <AuthCard
        alternatives={sso}
        description={t("desc")}
        footer={t.rich("already_have_account", {
          link: text => (
            <Link className="text-primary font-semibold" to={signInHref}>
              {text}
            </Link>
          ),
        })}
        form={form}
        notice={
          isUnavailable ? (
            <Alert>
              <AlertTitle>{t("unavailable.title")}</AlertTitle>
              <AlertDescription>{t("unavailable.desc")}</AlertDescription>
            </Alert>
          ) : undefined
        }
        title={tGlobal("register")}
      />
    </WrapperSignUp>
  );
};

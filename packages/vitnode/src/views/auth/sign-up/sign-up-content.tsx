"use client";

import { useTranslations } from "use-intl";

import { Card, CardDescription } from "@/components/ui/card";

import type { AuthLinkComponent } from "../auth-link";

import { AUTH_HREF } from "../auth-link";
import { WrapperSignUp } from "./wrapper";

export const SignUpContent = ({
  form,
  LinkComponent,
  signInHref = AUTH_HREF.signIn,
  sso,
}: {
  form: React.ReactNode;
  LinkComponent: AuthLinkComponent;
  signInHref?: string;
  sso?: React.ReactNode;
}) => {
  const t = useTranslations("core.auth.sign_up");
  const tGlobal = useTranslations("core.global");

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16 md:min-h-[calc(100vh-4rem)]">
      <WrapperSignUp>
        <Card className="bg-muted gap-0 p-0">
          <div className="bg-card rounded-xl p-6">
            <div className="mb-10 space-y-2 text-center">
              <h1 className="text-2xl leading-none font-semibold tracking-tight">
                {tGlobal("register")}
              </h1>
              <CardDescription>{t("desc")}</CardDescription>
            </div>

            {form}

            {sso}
          </div>

          <div className="text-accent-foreground p-6 text-center text-sm">
            {t.rich("already_have_account", {
              link: text => (
                <LinkComponent
                  className="text-primary font-semibold"
                  href={signInHref}
                >
                  {text}
                </LinkComponent>
              ),
            })}
          </div>
        </Card>
      </WrapperSignUp>
    </div>
  );
};

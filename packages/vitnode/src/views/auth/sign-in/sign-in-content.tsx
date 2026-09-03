"use client";

import { useTranslations } from "use-intl";

import { Card, CardDescription } from "@/components/ui/card";

import type { AuthLinkComponent } from "../auth-link";

import { AUTH_HREF } from "../auth-link";

export const SignInContent = ({
  LinkComponent,
  form,
  signUpHref = AUTH_HREF.signUp,
  sso,
}: {
  form: React.ReactNode;
  LinkComponent: AuthLinkComponent;
  signUpHref?: string;
  sso?: React.ReactNode;
}) => {
  const t = useTranslations("core.auth.sign_in");
  const tGlobal = useTranslations("core.global");

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16 md:min-h-[calc(100vh-4rem)]">
      <Card className="bg-muted gap-0 p-0">
        <div className="bg-card rounded-xl p-6">
          <div className="mb-10 space-y-2 text-center">
            <h1 className="text-2xl leading-none font-semibold tracking-tight">
              {tGlobal("login")}
            </h1>
            <CardDescription>{t("desc")}</CardDescription>
          </div>

          {form}

          {sso}
        </div>

        <div className="text-accent-foreground p-6 text-center text-sm">
          {t.rich("do_not_have_account", {
            link: text => (
              <LinkComponent
                className="text-primary font-semibold"
                href={signUpHref}
              >
                {text}
              </LinkComponent>
            ),
          })}
        </div>
      </Card>
    </div>
  );
};

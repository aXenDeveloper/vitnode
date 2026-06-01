import { getTranslations } from "next-intl/server";
import React from "react";

import { Card, CardDescription } from "@/components/ui/card";
import { getMiddlewareApi } from "@/lib/api/get-middleware-api";
import { Link } from "@/lib/navigation";

import { I18nProvider } from "../../../components/i18n-provider";
import { SSOButtons, SSOButtonsSkeleton } from "../sso/buttons/sso-buttons";
import { FormSignUp } from "./form/form";
import { WrapperSignUp } from "./wrapper";

export const SignUpView = async () => {
  const [t, tGlobal, { isEmail, captcha }] = await Promise.all([
    getTranslations("core.auth.sign_up"),
    getTranslations("core.global"),
    getMiddlewareApi(),
  ]);

  return (
    <I18nProvider namespaces="core.auth.sign_up">
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
              <FormSignUp captcha={captcha} isEmail={isEmail} />

              <React.Suspense fallback={<SSOButtonsSkeleton />}>
                <SSOButtons />
              </React.Suspense>
            </div>

            <div className="text-accent-foreground p-6 text-center text-sm">
              {t.rich("already_have_account", {
                link: text => (
                  <Link className="text-primary font-semibold" href="/login">
                    {text}
                  </Link>
                ),
              })}
            </div>
          </Card>
        </WrapperSignUp>
      </div>
    </I18nProvider>
  );
};

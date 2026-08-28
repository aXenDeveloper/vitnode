import { getTranslations } from "next-intl/server";
import React from "react";

import { Card, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getMiddlewareApi } from "@/lib/api/get-middleware-api";
import { Link } from "@/lib/navigation";

import { I18nProvider } from "../../../components/i18n-provider";
import { SSOButtons, SSOButtonsSkeleton } from "../sso/buttons/sso-buttons";
import { FormSignUp } from "./form/form";
import { WrapperSignUp } from "./wrapper";

const SignUpForm = async () => {
  const { isEmail, captcha } = await getMiddlewareApi();

  return <FormSignUp captcha={captcha} isEmail={isEmail} />;
};

const SignUpFormSkeleton = () => (
  <div className="space-y-8">
    {[0, 1, 2].map(field => (
      <div className="space-y-2" key={field}>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-full" />
      </div>
    ))}

    <div className="flex gap-2">
      <Skeleton className="size-4 shrink-0" />
      <Skeleton className="h-4 w-48" />
    </div>

    <Skeleton className="h-9 w-full" />
  </div>
);

export const SignUpView = async () => {
  const [t, tGlobal] = await Promise.all([
    getTranslations("core.auth.sign_up"),
    getTranslations("core.global"),
  ]);

  return (
    <I18nProvider namespaces={["core.auth.sign_up", "core.auth.sso"]}>
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

              <React.Suspense fallback={<SignUpFormSkeleton />}>
                <SignUpForm />
              </React.Suspense>

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

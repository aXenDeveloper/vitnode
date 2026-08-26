import type z from "zod";

import { notFound } from "next/navigation";
import React from "react";

import type { routeMiddlewareSchema } from "@/api/modules/middleware/route";

import { I18nProvider } from "@/components/i18n-provider";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getMiddlewareApi } from "@/lib/api/get-middleware-api";

import { ChangePasswordForm } from "./change-password-form/form";
import { PasswordResetForm } from "./form/form";

type Captcha = z.infer<typeof routeMiddlewareSchema>["captcha"];

const PasswordResetContent = async ({
  captcha,
  searchParams,
}: {
  captcha: Captcha;
  searchParams: Promise<{ token: string; userId: string }>;
}) => {
  const { token, userId } = await searchParams;

  if (token && userId) {
    return (
      <I18nProvider
        namespaces={["core.auth.sign_up", "core.auth.change_password"]}
      >
        <ChangePasswordForm token={token} userId={userId} />
      </I18nProvider>
    );
  }

  return (
    <I18nProvider
      namespaces={["core.auth.sign_up", "core.auth.reset_password"]}
    >
      <PasswordResetForm captcha={captcha} />
    </I18nProvider>
  );
};

const PasswordResetContentSkeleton = () => (
  <>
    <CardHeader className="flex flex-col items-center space-y-2 text-center">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-64" />
    </CardHeader>

    <CardContent className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="mt-4 h-9 w-full" />
    </CardContent>
  </>
);

export const PasswordResetView = async ({
  searchParams,
}: {
  searchParams: Promise<{ token: string; userId: string }>;
}) => {
  const { isEmail, captcha } = await getMiddlewareApi();
  if (!isEmail) notFound();

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16 md:min-h-[calc(100vh-4rem)]">
      <Card>
        <React.Suspense fallback={<PasswordResetContentSkeleton />}>
          <PasswordResetContent captcha={captcha} searchParams={searchParams} />
        </React.Suspense>
      </Card>
    </div>
  );
};

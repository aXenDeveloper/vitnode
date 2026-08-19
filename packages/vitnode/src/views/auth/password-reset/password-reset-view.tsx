import { notFound } from "next/navigation";
import React from "react";

import { I18nProvider } from "@/components/i18n-provider";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getMiddlewareApi } from "@/lib/api/get-middleware-api";

import { ChangePasswordForm } from "./change-password-form/form";
import { PasswordResetForm } from "./form/form";

const PasswordResetContent = async ({
  searchParams,
}: {
  searchParams: Promise<{ token: string; userId: string }>;
}) => {
  const [{ isEmail, captcha }, { token, userId }] = await Promise.all([
    getMiddlewareApi(),
    searchParams,
  ]);

  if (!isEmail) notFound();

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

export const PasswordResetView = ({
  searchParams,
}: {
  searchParams: Promise<{ token: string; userId: string }>;
}) => (
  <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16 md:min-h-[calc(100vh-4rem)]">
    <Card>
      <React.Suspense fallback={<PasswordResetContentSkeleton />}>
        <PasswordResetContent searchParams={searchParams} />
      </React.Suspense>
    </Card>
  </div>
);

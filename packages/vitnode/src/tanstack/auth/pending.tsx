import { useQueryClient } from "@tanstack/react-query";

import { Skeleton } from "@/components/ui/skeleton";
import { AuthCardSkeleton } from "@/views/auth/auth-card";
import { SignInFormSkeleton } from "@/views/auth/sign-in/form/sign-in-form-skeleton";
import { SignUpFormSkeleton } from "@/views/auth/sign-up/form/sign-up-form-skeleton";
import { SSOButtonsSkeleton } from "@/views/auth/sso/buttons/sso-buttons-skeleton";

import {
  authMethodsOf,
  middlewareConfigQueryOptions,
} from "./middleware-config";

const DEFAULT_SSO_COUNT = 2;

const useCachedConfig = () => {
  const data = useQueryClient().getQueryData(
    middlewareConfigQueryOptions().queryKey,
  );

  return data?.isKnown ? data : undefined;
};

export const LoginPendingSkeleton = () => {
  const config = useCachedConfig();
  const methods = config ? authMethodsOf(config) : undefined;
  const ssoCount = methods ? methods.sso.length : DEFAULT_SSO_COUNT;
  const hasPasskey = methods?.passkey ?? false;
  const hasAlternatives = ssoCount > 0 || hasPasskey;

  return (
    <AuthCardSkeleton
      alternatives={
        hasAlternatives ? (
          <>
            {ssoCount > 0 ? <SSOButtonsSkeleton count={ssoCount} /> : null}
            {hasPasskey ? <Skeleton className="h-9 w-full" /> : null}
          </>
        ) : undefined
      }
      form={
        (methods?.password ?? true) ? (
          <SignInFormSkeleton
            withResetPassword={methods?.resetPassword ?? true}
          />
        ) : undefined
      }
    />
  );
};

export const RegisterPendingSkeleton = () => {
  const config = useCachedConfig();
  const methods = config ? authMethodsOf(config) : undefined;
  const ssoCount = methods ? methods.sso.length : DEFAULT_SSO_COUNT;

  return (
    <AuthCardSkeleton
      alternatives={
        ssoCount > 0 ? (
          <SSOButtonsSkeleton count={ssoCount} layout="stack" />
        ) : undefined
      }
      form={
        (methods?.password ?? true) ? (
          <SignUpFormSkeleton withNewsletter={config?.isEmail ?? true} />
        ) : undefined
      }
    />
  );
};

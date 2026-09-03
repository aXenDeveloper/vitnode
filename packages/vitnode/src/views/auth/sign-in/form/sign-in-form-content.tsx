"use client";

import { AlertCircle } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "use-intl";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { SHAKE_KEYFRAMES, SHAKE_TRANSITION } from "@/lib/motion";

import type { AuthLinkComponent } from "../../auth-link";

import { AUTH_HREF } from "../../auth-link";
import { type SignInSubmit, useSignInForm } from "./use-sign-in-form";

export type { SignInSubmit };

export const SignInFormContent = ({
  LinkComponent,
  onSignIn,
  resetPasswordHref = AUTH_HREF.resetPassword,
  showResetPassword = false,
}: {
  LinkComponent?: AuthLinkComponent;
  onSignIn: SignInSubmit;
  resetPasswordHref?: string;
  /** Whether this deployment has an email adapter that can send a reset link. */
  showResetPassword?: boolean;
}) => {
  const t = useTranslations("core.auth.sign_in");
  const shouldReduceMotion = useReducedMotion();
  const { error, formSchema, onSubmit } = useSignInForm({ onSignIn });

  return (
    <div className="space-y-4">
      {error && (
        <motion.div
          animate={shouldReduceMotion ? undefined : SHAKE_KEYFRAMES}
          transition={SHAKE_TRANSITION}
        >
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>{t(`errors.${error}.title`)}</AlertTitle>
            <AlertDescription>{t(`errors.${error}.desc`)}</AlertDescription>
          </Alert>
        </motion.div>
      )}

      <AutoForm
        fields={[
          {
            id: "email",
            component: props => (
              <AutoFormInput label={t("email.label")} {...props} />
            ),
          },
          {
            id: "password",
            component: props => (
              <AutoFormInput
                label={t("password.label")}
                labelRight={
                  showResetPassword && LinkComponent ? (
                    <LinkComponent
                      className="text-primary hover:underline"
                      href={resetPasswordHref}
                    >
                      {t("password.reset")}
                    </LinkComponent>
                  ) : undefined
                }
                type="password"
                {...props}
              />
            ),
          },
        ]}
        formSchema={formSchema}
        onSubmit={onSubmit}
        submitButtonProps={{
          className: "w-full",
          children: t("submit"),
        }}
      />
    </div>
  );
};

/** The form's shape while the deployment configuration is still in flight. */
export const SignInFormSkeleton = () => (
  <div className="space-y-8">
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-full" />
    </div>

    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-full" />
    </div>

    <Skeleton className="h-9 w-full" />
  </div>
);

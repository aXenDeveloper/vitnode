import type { z } from "zod";

import { Link } from "@tanstack/react-router";
import { LockIcon, MailIcon } from "lucide-react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { useTranslations } from "use-intl";

import type { routeMiddlewareSchema } from "@/api/modules/middleware/route";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";
import { MotionFeatures } from "@/components/motion-features";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useFormApi } from "@/components/ui/form";
import { InputGroupAddon } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  REVEAL_EXIT_TRANSITION,
  REVEAL_HIDDEN,
  REVEAL_SHOWN,
  REVEAL_TRANSITION,
  SHAKE_KEYFRAMES,
  SHAKE_TRANSITION,
} from "@/lib/motion";

import { AUTH_HREF } from "../../auth-link";
import { AuthStep } from "../../auth-step";
import {
  PasswordResetSteps,
  PasswordResetTrigger,
} from "../../password-reset/form/password-reset-steps";
import {
  type PasswordReset,
  type PasswordResetSubmit,
  usePasswordReset,
} from "../../password-reset/form/use-password-reset-form";
import { type SignInSubmit, useSignInForm } from "./use-sign-in-form";

export type { SignInSubmit };

const ResetPasswordButton = ({ reset }: { reset: PasswordReset }) => {
  const t = useTranslations("core.auth.sign_in");
  const { form } = useFormApi();

  return (
    <PasswordResetTrigger
      isSending={reset.isSending}
      onClick={() => {
        void reset.start(form.getFieldValue("email"));
      }}
    >
      {t("password.reset")}
    </PasswordResetTrigger>
  );
};

export const SignInFormContent = ({
  captcha,
  onRequestReset,
  onSignIn,
  resendVerificationHref = AUTH_HREF.verifyEmail,
  showResetPassword = false,
}: {
  captcha?: z.infer<typeof routeMiddlewareSchema>["captcha"];
  onRequestReset?: PasswordResetSubmit;
  onSignIn: SignInSubmit;
  resendVerificationHref?: string;
  /** Whether this deployment has an email adapter that can send a reset link. */
  showResetPassword?: boolean;
}) => {
  const t = useTranslations("core.auth.sign_in");
  const shouldReduceMotion = useReducedMotion();
  const { error, formSchema, onSubmit, repeat } = useSignInForm({ onSignIn });
  const reset = usePasswordReset({ captcha, onRequestReset });

  if (reset.step.kind !== "idle") {
    return <PasswordResetSteps captcha={captcha} reset={reset} />;
  }

  return (
    <AuthStep className="gap-0" key="sign-in">
      <MotionFeatures>
        <AnimatePresence>
          {error && (
            <m.div
              animate={REVEAL_SHOWN}
              className="overflow-y-clip"
              exit={
                shouldReduceMotion
                  ? undefined
                  : { ...REVEAL_HIDDEN, transition: REVEAL_EXIT_TRANSITION }
              }
              initial={shouldReduceMotion ? false : REVEAL_HIDDEN}
              key="error"
              transition={REVEAL_TRANSITION}
            >
              <m.div
                animate={shouldReduceMotion ? undefined : SHAKE_KEYFRAMES}
                className="pb-4"
                key={repeat}
                transition={{
                  ...SHAKE_TRANSITION,
                  delay: repeat === 0 ? REVEAL_TRANSITION.height.duration : 0,
                }}
              >
                <Alert
                  variant={
                    error === "email_not_verified" ? "default" : "destructive"
                  }
                >
                  <AlertTitle>{t(`errors.${error}.title`)}</AlertTitle>
                  <AlertDescription>
                    <p>{t(`errors.${error}.desc`)}</p>
                    {error === "email_not_verified" ? (
                      <p>
                        <Link
                          className="font-medium"
                          to={resendVerificationHref}
                        >
                          {t("errors.email_not_verified.resend")}
                        </Link>
                      </p>
                    ) : null}
                  </AlertDescription>
                </Alert>
              </m.div>
            </m.div>
          )}
        </AnimatePresence>
      </MotionFeatures>

      <AutoForm
        fields={[
          {
            id: "email",
            component: props => (
              <AutoFormInput
                autoComplete="email"
                inputMode="email"
                label={t("email.label")}
                {...props}
              >
                <InputGroupAddon>
                  <MailIcon />
                </InputGroupAddon>
              </AutoFormInput>
            ),
          },
          {
            id: "password",
            component: props => (
              <AutoFormInput
                autoComplete="current-password"
                label={t("password.label")}
                labelRight={
                  showResetPassword && reset.canRequest ? (
                    <ResetPasswordButton reset={reset} />
                  ) : undefined
                }
                type="password"
                {...props}
              >
                <InputGroupAddon>
                  <LockIcon />
                </InputGroupAddon>
              </AutoFormInput>
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
    </AuthStep>
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

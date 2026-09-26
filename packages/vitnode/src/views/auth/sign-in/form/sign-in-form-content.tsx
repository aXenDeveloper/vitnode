import { Link } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "use-intl";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { type SignInSubmit, useSignInForm } from "./use-sign-in-form";

export type { SignInSubmit };

export const SignInFormContent = ({
  onSignIn,
  resetPasswordHref = AUTH_HREF.resetPassword,
  showResetPassword = false,
}: {
  onSignIn: SignInSubmit;
  resetPasswordHref?: string;
  /** Whether this deployment has an email adapter that can send a reset link. */
  showResetPassword?: boolean;
}) => {
  const t = useTranslations("core.auth.sign_in");
  const shouldReduceMotion = useReducedMotion();
  const { error, formSchema, onSubmit, repeat } = useSignInForm({ onSignIn });

  return (
    <div>
      <AnimatePresence>
        {error && (
          <motion.div
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
            <motion.div
              animate={shouldReduceMotion ? undefined : SHAKE_KEYFRAMES}
              className="pb-4"
              key={repeat}
              transition={{
                ...SHAKE_TRANSITION,
                delay: repeat === 0 ? REVEAL_TRANSITION.height.duration : 0,
              }}
            >
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>{t(`errors.${error}.title`)}</AlertTitle>
                <AlertDescription>{t(`errors.${error}.desc`)}</AlertDescription>
              </Alert>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  showResetPassword ? (
                    <Link
                      className="text-primary hover:underline"
                      to={resetPasswordHref}
                    >
                      {t("password.reset")}
                    </Link>
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

import type { z } from "zod";

import { Link } from "@tanstack/react-router";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { useTranslations } from "use-intl";

import type { routeMiddlewareSchema } from "@/api/modules/middleware/route";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";
import { MotionFeatures } from "@/components/motion-features";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SHAKE_KEYFRAMES, SHAKE_TRANSITION } from "@/lib/motion";

import type { SSOLinkOffer } from "./schema";

import { AUTH_HREF } from "../../auth-link";
import { AuthStep } from "../../auth-step";
import {
  PasswordResetSteps,
  PasswordResetTrigger,
} from "../../password-reset/form/password-reset-steps";
import {
  type PasswordResetSubmit,
  usePasswordReset,
} from "../../password-reset/form/use-password-reset-form";
import { type SSOLinkSubmit, useSSOLinkForm } from "./use-sso-link-form";

export type { SSOLinkSubmit };

const EMAIL_FIELD_ID = "sso-link-email";

export const SSOLinkFormContent = ({
  captcha,
  offer,
  onLink,
  onRequestReset,
  providerName,
  showResetPassword = false,
  signInHref = AUTH_HREF.signIn,
}: {
  captcha?: z.infer<typeof routeMiddlewareSchema>["captcha"];
  offer: SSOLinkOffer;
  onLink: SSOLinkSubmit;
  onRequestReset?: PasswordResetSubmit;
  providerName: () => React.ReactNode;
  showResetPassword?: boolean;
  signInHref?: string;
}) => {
  const t = useTranslations("core.auth.sso.link");
  const shouldReduceMotion = useReducedMotion();
  const { error, formSchema, onSubmit } = useSSOLinkForm({ offer, onLink });
  const reset = usePasswordReset({ captcha, onRequestReset });
  const canReset = showResetPassword && reset.canRequest;

  if (reset.step.kind !== "idle") {
    return <PasswordResetSteps captcha={captcha} reset={reset} />;
  }

  return (
    <MotionFeatures>
      <AuthStep key="link">
        {error && (
          <m.div
            animate={shouldReduceMotion ? undefined : SHAKE_KEYFRAMES}
            transition={SHAKE_TRANSITION}
          >
            <Alert variant="destructive">
              <AlertTitle>{t(`errors.${error}.title`)}</AlertTitle>
              <AlertDescription>{t(`errors.${error}.desc`)}</AlertDescription>
            </Alert>
          </m.div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor={EMAIL_FIELD_ID}>{t("email")}</Label>
          <Input disabled id={EMAIL_FIELD_ID} readOnly value={offer.email} />
        </div>

        {offer.hasPassword ? (
          <AutoForm
            fields={[
              {
                id: "password",
                component: props => (
                  <AutoFormInput
                    autoFocus
                    label={t("password.label")}
                    labelRight={
                      canReset ? (
                        <PasswordResetTrigger
                          isSending={reset.isSending}
                          onClick={() => {
                            void reset.start(offer.email);
                          }}
                        >
                          {t("password.reset")}
                        </PasswordResetTrigger>
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
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
              {t.rich("no_password.desc", { provider: providerName })}
            </p>

            {canReset ? (
              <Button
                className="w-full"
                isLoading={reset.isSending}
                onClick={() => {
                  void reset.start(offer.email);
                }}
                type="button"
              >
                {t("no_password.set_password")}
              </Button>
            ) : (
              <Button
                className="w-full"
                nativeButton={false}
                render={<Link to={signInHref} />}
              >
                {t("no_password.sign_in")}
              </Button>
            )}
          </div>
        )}
      </AuthStep>
    </MotionFeatures>
  );
};

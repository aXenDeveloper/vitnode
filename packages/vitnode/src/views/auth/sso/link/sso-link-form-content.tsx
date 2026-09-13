import { Link } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "use-intl";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SHAKE_KEYFRAMES, SHAKE_TRANSITION } from "@/lib/motion";

import type { SSOLinkOffer } from "./schema";

import { AUTH_HREF } from "../../auth-link";
import { type SSOLinkSubmit, useSSOLinkForm } from "./use-sso-link-form";

export type { SSOLinkSubmit };

const EMAIL_FIELD_ID = "sso-link-email";

export const SSOLinkFormContent = ({
  offer,
  onLink,
  providerName,
  resetPasswordHref = AUTH_HREF.resetPassword,
  showResetPassword = false,
  signInHref = AUTH_HREF.signIn,
}: {
  offer: SSOLinkOffer;
  onLink: SSOLinkSubmit;
  providerName: () => React.ReactNode;
  resetPasswordHref?: string;
  showResetPassword?: boolean;
  signInHref?: string;
}) => {
  const t = useTranslations("core.auth.sso.link");
  const shouldReduceMotion = useReducedMotion();
  const { error, formSchema, onSubmit } = useSSOLinkForm({ offer, onLink });

  return (
    <div className="flex flex-col gap-6">
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
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {t.rich("no_password.desc", { provider: providerName })}
          </p>

          <Button
            className="w-full"
            nativeButton={false}
            render={
              <Link to={showResetPassword ? resetPasswordHref : signInHref} />
            }
          >
            {showResetPassword
              ? t("no_password.set_password")
              : t("no_password.sign_in")}
          </Button>
        </div>
      )}
    </div>
  );
};

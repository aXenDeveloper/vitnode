import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { AutoForm, setFormFieldError } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";
import { AutoFormInputOTP } from "@/components/form/fields/input-otp";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import type { SSOLinkOffer } from "../link/schema";
import type {
  SSOSendEmailCodeResult,
  SSOVerifyEmailCodeResult,
} from "./sso-email-mutations";

import { AUTH_HREF } from "../../auth-link";

export interface SSOEmailCompletionActions {
  sendCode: (email: string) => Promise<SSOSendEmailCodeResult>;
  /** Resolves after a successful sign-in has been handled. */
  verifyCode: (code: string) => Promise<SSOVerifyEmailCodeResult>;
}

/**
 * Asks for an email address and the code sent to it, for a provider that
 * shared no verified address. Hands a link offer to `onLinkRequired` when the
 * confirmed address already has an account.
 */
export const SSOEmailCompletion = ({
  actions,
  emailSuggestion,
  onLinkRequired,
  providerName,
  signInHref = AUTH_HREF.signIn,
}: {
  actions: SSOEmailCompletionActions;
  emailSuggestion: null | string;
  onLinkRequired: (offer: SSOLinkOffer) => void;
  providerName: () => React.ReactNode;
  signInHref?: string;
}) => {
  const t = useTranslations("core.auth.sso.email_completion");
  const tErrors = useTranslations("core.global.errors");
  const [sentTo, setSentTo] = useState<null | string>(null);
  const [expired, setExpired] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const emailSchema = z.object({
    email: z
      .email({ message: t("email.invalid") })
      .max(255)
      .default(emailSuggestion ?? ""),
  });
  const codeSchema = z.object({
    code: z
      .string()
      .regex(/^\d{6}$/, { message: t("code.invalid") })
      .default(""),
  });

  const failToast = (failure: "server_error" | "too_many_codes") => {
    if (failure === "too_many_codes") {
      toast.error(t("errors.too_many_codes.title"), {
        description: t("errors.too_many_codes.desc"),
      });

      return;
    }

    toast.error(tErrors("title"), {
      description: tErrors("internal_server_error"),
    });
  };

  const send = async (email: string): Promise<boolean> => {
    const result = await actions.sendCode(email);
    if (result.ok) {
      setSentTo(email);

      return true;
    }
    if (result.failure === "invalid_pending") {
      setExpired(true);

      return false;
    }

    failToast(result.failure);

    return false;
  };

  if (expired) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="destructive">
          <AlertTitle>{t("errors.invalid_pending.title")}</AlertTitle>
          <AlertDescription>
            {t.rich("errors.invalid_pending.desc", { provider: providerName })}
          </AlertDescription>
        </Alert>
        <Button
          className="w-full"
          nativeButton={false}
          render={<Link to={signInHref} />}
        >
          {t("start_again")}
        </Button>
      </div>
    );
  }

  if (!sentTo) {
    return (
      <AutoForm
        fields={[
          {
            id: "email",
            component: props => (
              <AutoFormInput
                {...props}
                autoComplete="email"
                autoFocus
                description={t("email.desc")}
                inputMode="email"
                label={t("email.label")}
                type="email"
              />
            ),
          },
        ]}
        formSchema={emailSchema}
        onSubmit={async ({ email }) => {
          await send(email);
        }}
        submitButtonProps={{ className: "w-full", children: t("email.submit") }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p
        aria-live="polite"
        className="text-muted-foreground text-sm leading-relaxed text-pretty"
      >
        {t.rich("code.sent", {
          email: () => (
            <span className="text-foreground font-semibold break-words">
              {sentTo}
            </span>
          ),
        })}
      </p>

      <AutoForm
        fields={[
          {
            id: "code",
            component: props => (
              <AutoFormInputOTP
                {...props}
                autoComplete="one-time-code"
                autoFocus
                inputMode="numeric"
                label={t("code.label")}
              />
            ),
          },
        ]}
        formSchema={codeSchema}
        onSubmit={async ({ code }, form) => {
          const result: SSOVerifyEmailCodeResult =
            await actions.verifyCode(code);
          if (result.ok) return;

          if (result.failure === "link_required") {
            onLinkRequired(result.offer);

            return;
          }
          if (result.failure === "invalid_pending") {
            setExpired(true);

            return;
          }
          if (result.failure === "server_error") {
            failToast("server_error");

            return;
          }

          setFormFieldError(form, "code", t(`errors.${result.failure}`));
        }}
        submitButtonProps={{ className: "w-full", children: t("code.submit") }}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button
          disabled={isResending}
          isLoading={isResending}
          onClick={async () => {
            setIsResending(true);
            try {
              if (await send(sentTo)) toast.success(t("code.resent"));
            } finally {
              setIsResending(false);
            }
          }}
          variant="ghost"
        >
          {t("code.resend")}
        </Button>
        <Button
          disabled={isResending}
          onClick={() => {
            setSentTo(null);
          }}
          variant="ghost"
        >
          {t("code.change_email")}
        </Button>
      </div>
    </div>
  );
};

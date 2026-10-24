import { Link } from "@tanstack/react-router";
import {
  MailCheckIcon,
  MailIcon,
  PencilIcon,
  RotateCwIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardDescription } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "@/components/ui/empty";
import { InputGroupAddon } from "@/components/ui/input-group";

import type { SSOSendEmailLinkResult } from "./sso-email-mutations";

import { AUTH_HREF } from "../../auth-link";

export interface SSOEmailCompletionActions {
  sendLink: (email: string) => Promise<SSOSendEmailLinkResult>;
}

/**
 * Asks for an email address and sends a confirmation link to it, for a
 * provider that shared no verified address. The sign-in finishes when the
 * link is opened in this browser.
 */
export const SSOEmailCompletion = ({
  actions,
  emailSuggestion,
  providerName,
  signInHref = AUTH_HREF.signIn,
}: {
  actions: SSOEmailCompletionActions;
  emailSuggestion: null | string;
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
      .default(sentTo ?? emailSuggestion ?? ""),
  });

  const send = async (email: string): Promise<boolean> => {
    const result = await actions.sendLink(email);
    if (result.ok) {
      setSentTo(email);

      return true;
    }
    if (result.failure === "invalid_pending") {
      setExpired(true);

      return false;
    }
    if (result.failure === "too_many_emails") {
      toast.error(t("errors.too_many_emails.title"), {
        description: t("errors.too_many_emails.desc"),
      });

      return false;
    }

    toast.error(tErrors("title"), {
      description: tErrors("internal_server_error"),
    });

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

  if (sentTo) {
    return (
      <Empty className="gap-6 border-0 p-0 md:p-0">
        <EmptyHeader className="gap-3">
          <EmptyMedia variant="icon">
            <MailCheckIcon aria-hidden />
          </EmptyMedia>
          <h1 className="text-2xl leading-none font-semibold tracking-tight text-balance">
            {t("sent.title")}
          </h1>
          <EmptyDescription aria-live="polite" className="text-pretty">
            {t.rich("sent.desc", {
              email: () => (
                <span className="text-foreground font-semibold break-words">
                  {sentTo}
                </span>
              ),
            })}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            <Button
              disabled={isResending}
              isLoading={isResending}
              onClick={async () => {
                setIsResending(true);
                try {
                  if (await send(sentTo)) toast.success(t("sent.resent"));
                } finally {
                  setIsResending(false);
                }
              }}
              variant="outline"
            >
              <RotateCwIcon aria-hidden />
              {t("sent.resend")}
            </Button>
            <Button
              disabled={isResending}
              onClick={() => {
                setSentTo(null);
              }}
              variant="ghost"
            >
              <PencilIcon aria-hidden />
              {t("sent.change_email")}
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl leading-none font-semibold tracking-tight text-balance">
          {t("title")}
        </h1>
        <CardDescription className="text-pretty">
          {t.rich("desc", { provider: providerName })}
        </CardDescription>
      </div>

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
              >
                <InputGroupAddon>
                  <MailIcon />
                </InputGroupAddon>
              </AutoFormInput>
            ),
          },
        ]}
        formSchema={emailSchema}
        onSubmit={async ({ email }) => {
          await send(email);
        }}
        submitButtonProps={{ className: "w-full", children: t("email.submit") }}
      />
    </div>
  );
};

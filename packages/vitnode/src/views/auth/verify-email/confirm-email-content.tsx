import { Link } from "@tanstack/react-router";
import { MailCheckIcon, MailWarningIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { ConfirmEmailMutationResult, ConfirmEmailSubmit } from "./schema";

import { AUTH_HREF } from "../auth-link";

export type { ConfirmEmailSubmit };

type ConfirmState = Exclude<ConfirmEmailMutationResult, { kind: "error" }>;

const ConfirmedView = ({
  email,
  signInHref,
}: {
  email: string;
  signInHref: string;
}) => {
  const t = useTranslations("core.auth.verify_email.success");

  return (
    <>
      <CardHeader className="flex flex-col items-center text-center">
        <div className="mb-3 rounded-2xl border p-3">
          <MailCheckIcon aria-hidden="true" className="size-8" />
        </div>
        <CardTitle className="text-balance">
          <h1>{t("title")}</h1>
        </CardTitle>
        <CardDescription className="text-pretty" role="status">
          {t.rich("desc", {
            email: () => (
              <span className="text-foreground font-medium break-all">
                {email}
              </span>
            ),
          })}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Link
          className={buttonVariants({ className: "w-full" })}
          to={signInHref}
        >
          {t("sign_in")}
        </Link>
      </CardContent>
    </>
  );
};

const InvalidLinkView = ({ resendHref }: { resendHref: string }) => {
  const t = useTranslations("core.auth.verify_email.invalid");

  return (
    <>
      <CardHeader className="flex flex-col items-center text-center">
        <div className="mb-3 rounded-2xl border p-3">
          <MailWarningIcon aria-hidden="true" className="size-8" />
        </div>
        <CardTitle className="text-balance">
          <h1>{t("title")}</h1>
        </CardTitle>
        <CardDescription className="text-pretty" role="alert">
          {t("desc")}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Link
          className={buttonVariants({
            className: "w-full",
            variant: "outline",
          })}
          to={resendHref}
        >
          {t("resend")}
        </Link>
      </CardContent>
    </>
  );
};

/**
 * The screen a confirmation link opens.
 *
 * It waits for a click rather than spending the link on load: mail scanners and
 * link previews open every URL in an email, and one that confirmed on arrival
 * would let a scanner confirm an account its owner never asked for.
 */
export const ConfirmEmailContent = ({
  onConfirm,
  resendHref = AUTH_HREF.verifyEmail,
  signInHref = AUTH_HREF.signIn,
}: {
  onConfirm: ConfirmEmailSubmit;
  resendHref?: string;
  signInHref?: string;
}) => {
  const t = useTranslations("core.auth.verify_email");
  const tErrors = useTranslations("core.global.errors");
  const [state, setState] = React.useState<ConfirmState | null>(null);
  const [isPending, setIsPending] = React.useState(false);

  const onClick = async () => {
    setIsPending(true);

    try {
      const result = await onConfirm();

      if (result.kind === "error") {
        toast.error(tErrors("title"), {
          description: tErrors("internal_server_error"),
        });

        return;
      }

      setState(result);
    } finally {
      setIsPending(false);
    }
  };

  if (state?.kind === "confirmed") {
    return <ConfirmedView email={state.email} signInHref={signInHref} />;
  }

  if (state?.kind === "invalid_token") {
    return <InvalidLinkView resendHref={resendHref} />;
  }

  return (
    <>
      <CardHeader className="flex flex-col items-center text-center">
        <div className="mb-3 rounded-2xl border p-3">
          <MailCheckIcon aria-hidden="true" className="size-8" />
        </div>
        <CardTitle className="text-balance">
          <h1>{t("title")}</h1>
        </CardTitle>
        <CardDescription className="text-pretty">
          {t("confirm.desc")}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Button
          className="w-full"
          disabled={isPending}
          isLoading={isPending}
          onClick={onClick}
          type="button"
        >
          {t("confirm.submit")}
        </Button>
      </CardContent>
    </>
  );
};

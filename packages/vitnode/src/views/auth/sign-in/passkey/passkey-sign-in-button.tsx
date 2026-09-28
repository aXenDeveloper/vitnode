import { cn } from "cn";
import { KeyRoundIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";

import { usePasskeySupport } from "../../passkeys/webauthn";

export type PasskeySignInFeedback =
  | "cancelled"
  | "expired"
  | "failed"
  | "not_staff"
  | "rejected"
  | "server_error"
  | "unavailable"
  | "unsupported";

export type PasskeySignInSubmit = () => Promise<
  PasskeySignInFeedback | undefined
>;

export const PasskeySignInButton = ({
  onSignIn,
  showDivider = true,
}: {
  onSignIn: PasskeySignInSubmit;
  showDivider?: boolean;
}) => {
  const t = useTranslations("core.auth.sign_in.passkey");
  const tGlobal = useTranslations("core.global");
  const tErrors = useTranslations("core.global.errors");
  const isSupported = usePasskeySupport();
  const [isPending, setIsPending] = React.useState(false);
  const hintId = React.useId();

  const showFeedback = (feedback: PasskeySignInFeedback) => {
    if (feedback === "cancelled") {
      toast.info(t("cancelled.title"), {
        description: t("cancelled.desc"),
      });

      return;
    }

    if (feedback === "server_error") {
      toast.error(tErrors("title"), {
        description: tErrors("internal_server_error"),
      });

      return;
    }

    toast.error(t(`errors.${feedback}.title`), {
      description: t(`errors.${feedback}.desc`),
    });
  };

  const onClick = async () => {
    setIsPending(true);

    try {
      const feedback = await onSignIn();
      if (feedback) showFeedback(feedback);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-4", showDivider && "pt-6")}>
      {showDivider ? (
        <div className="flex items-center gap-4" role="presentation">
          <span className="flex-1 border-t" />
          <span className="text-muted-foreground text-xs">{tGlobal("or")}</span>
          <span className="flex-1 border-t" />
        </div>
      ) : null}

      <Button
        aria-describedby={isSupported ? undefined : hintId}
        className="w-full"
        disabled={!isSupported || isPending}
        isLoading={isPending}
        onClick={onClick}
        type="button"
        variant="outline"
      >
        <KeyRoundIcon aria-hidden="true" />
        {t("action")}
      </Button>

      {isSupported ? null : (
        <p
          className="text-muted-foreground text-center text-sm leading-relaxed text-pretty"
          id={hintId}
        >
          {t("unsupported_hint")}
        </p>
      )}
    </div>
  );
};

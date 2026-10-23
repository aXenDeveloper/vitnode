import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { routeMiddlewareSchema } from "@/api/modules/middleware/route";

import type {
  PasswordResetMutationResult,
  PasswordResetSubmitValues,
} from "./schema";

import { rememberEmail } from "../../remembered-email";
import { passwordResetFormOutcome } from "./schema";

export type { PasswordResetSubmitValues };

export type PasswordResetSubmit = (
  values: PasswordResetSubmitValues,
) => Promise<PasswordResetMutationResult>;

export type PasswordResetStep =
  | { email: string; kind: "sent" }
  | { kind: "form" }
  | { kind: "idle" };

const isEmailAddress = (value: string) => z.email().safeParse(value).success;

export const usePasswordReset = ({
  captcha,
  onRequestReset,
}: {
  captcha?: z.infer<typeof routeMiddlewareSchema>["captcha"];
  onRequestReset?: PasswordResetSubmit;
}) => {
  const tErrors = useTranslations("core.global.errors");
  const [step, setStep] = React.useState<PasswordResetStep>({ kind: "idle" });
  const [isSending, setIsSending] = React.useState(false);

  const show = (next: PasswordResetStep) => {
    React.startTransition(() => {
      setStep(next);
    });
  };

  const send = async ({ captchaToken, email }: PasswordResetSubmitValues) => {
    if (!onRequestReset) {
      throw new Error("A password reset was started without onRequestReset.");
    }

    const outcome = passwordResetFormOutcome(
      await onRequestReset({ captchaToken, email }),
    );

    if (outcome.kind === "toast") {
      toast.error(tErrors("title"), {
        description: tErrors("internal_server_error"),
      });

      return;
    }

    show({ email, kind: "sent" });
  };

  const start = async (email: unknown) => {
    rememberEmail(email);
    const address = typeof email === "string" ? email.trim() : "";

    if (captcha || !isEmailAddress(address)) {
      show({ kind: "form" });

      return;
    }

    setIsSending(true);

    try {
      await send({ captchaToken: "", email: address });
    } finally {
      setIsSending(false);
    }
  };

  return {
    back: () => {
      show({ kind: "idle" });
    },
    canRequest: !!onRequestReset,
    isSending,
    send,
    start,
    step,
  };
};

export type PasswordReset = ReturnType<typeof usePasswordReset>;

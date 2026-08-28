"use client";

import type z from "zod";

import { MailCheckIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import type { routeMiddlewareSchema } from "@/api/modules/middleware/route";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  type PasswordResetSubmit,
  usePasswordResetForm,
} from "./use-password-reset-form";

export type { PasswordResetSubmit };

/**
 * "We have sent you a link", and the address it went to.
 *
 * Shown for every accepted request, including one for an address with no
 * account: the API answers `201` either way, so this screen is the only thing a
 * visitor - or somebody probing for registered addresses - ever sees.
 */
const ConfirmationView = ({ email }: { email: string }) => {
  const t = useTranslations("core.auth.reset_password");
  const tSignUp = useTranslations("core.auth.sign_up");

  return (
    <>
      <CardHeader className="flex flex-col items-center text-center">
        <div className="mb-3 rounded-2xl border p-3">
          <MailCheckIcon className="size-8" />
        </div>
        <CardTitle className="text-balance">
          {t("confirmation.title")}
        </CardTitle>
        <CardDescription className="text-pretty">
          {t("confirmation.desc")}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-2">
        <Label htmlFor="email">{tSignUp("email.label")}</Label>
        <Input className="w-full" id="email" readOnly value={email} />
      </CardContent>

      <CardFooter>
        <CardDescription>{t("confirmation.check_spam")}</CardDescription>
      </CardFooter>
    </>
  );
};

/**
 * The first half of password recovery - shared.
 *
 * One field, one captcha and one callback: {@link PasswordResetSubmit} is the
 * only framework-specific part, and it is a prop. The form no longer imports a
 * server action, so a TanStack Start route renders exactly the card the Next.js
 * page renders.
 */
export const PasswordResetFormContent = ({
  captcha,
  onRequestReset,
}: {
  captcha: z.infer<typeof routeMiddlewareSchema>["captcha"];
  onRequestReset: PasswordResetSubmit;
}) => {
  const { formSchema, onSubmit, sentEmail } = usePasswordResetForm({
    onRequestReset,
  });
  const t = useTranslations("core.auth.reset_password");
  const tSignUp = useTranslations("core.auth.sign_up");

  if (sentEmail) {
    return <ConfirmationView email={sentEmail} />;
  }

  return (
    <>
      <CardHeader className="text-center">
        <CardTitle>
          <h1>{t("title")}</h1>
        </CardTitle>
        <CardDescription>{t("desc")}</CardDescription>
      </CardHeader>

      <CardContent>
        <AutoForm
          captcha={captcha}
          fields={[
            {
              id: "email",
              component: props => (
                <AutoFormInput {...props} label={tSignUp("email.label")} />
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
      </CardContent>
    </>
  );
};

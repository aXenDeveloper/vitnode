import type z from "zod";

import { MailCheckIcon, MailIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { routeMiddlewareSchema } from "@/api/modules/middleware/route";
import type { AutoFormOnSubmit } from "@/components/form/auto-form";

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
import { InputGroupAddon } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";

import type {
  ResendVerificationFormSchema,
  ResendVerificationSubmit,
} from "./schema";

import { readRememberedEmail } from "../remembered-email";
import { createResendVerificationFormSchema } from "./schema";

export type { ResendVerificationSubmit };

const SentView = ({ email }: { email: string }) => {
  const t = useTranslations("core.auth.verify_email.resend.confirmation");
  const tSignUp = useTranslations("core.auth.sign_up");
  const id = React.useId();

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
          {t("desc")}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-2">
        <Label htmlFor={id}>{tSignUp("email.label")}</Label>
        <Input className="w-full" id={id} readOnly value={email} />
      </CardContent>

      <CardFooter>
        <CardDescription>{t("check_spam")}</CardDescription>
      </CardFooter>
    </>
  );
};

export const ResendVerificationFormContent = ({
  captcha,
  onResend,
}: {
  captcha: z.infer<typeof routeMiddlewareSchema>["captcha"];
  onResend: ResendVerificationSubmit;
}) => {
  const t = useTranslations("core.auth.verify_email.resend");
  const tSignUp = useTranslations("core.auth.sign_up");
  const tErrors = useTranslations("core.global.errors");
  const [sentEmail, setSentEmail] = React.useState("");

  const formSchema = createResendVerificationFormSchema(
    { invalidEmail: tSignUp("email.invalid") },
    { defaultEmail: readRememberedEmail() },
  );

  const onSubmit: AutoFormOnSubmit<ResendVerificationFormSchema> = async (
    { email },
    _form,
    { captchaToken },
  ) => {
    const result = await onResend({ captchaToken, email });

    if (result?.message) {
      toast.error(tErrors("title"), {
        description: tErrors("internal_server_error"),
      });

      return;
    }

    setSentEmail(email);
  };

  if (sentEmail) return <SentView email={sentEmail} />;

  return (
    <>
      <CardHeader className="text-center">
        <CardTitle className="text-balance">
          <h1>{t("title")}</h1>
        </CardTitle>
        <CardDescription className="text-pretty">{t("desc")}</CardDescription>
      </CardHeader>

      <CardContent>
        <AutoForm
          captcha={captcha}
          fields={[
            {
              id: "email",
              component: props => (
                <AutoFormInput
                  {...props}
                  autoComplete="email"
                  inputMode="email"
                  label={tSignUp("email.label")}
                >
                  <InputGroupAddon>
                    <MailIcon />
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
      </CardContent>
    </>
  );
};

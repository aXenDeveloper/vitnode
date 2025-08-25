"use client";

import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "@/lib/navigation";

import { useFormSignIn } from "./use-form";

export const FormSignIn = ({
  isAdmin,
  isEmail,
}: {
  isAdmin?: boolean;
  isEmail: boolean;
}) => {
  const t = useTranslations("core.auth.sign_in");
  const { onSubmit, error, formSchema } = useFormSignIn({ isAdmin });

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>{t(`errors.${error}.title`)}</AlertTitle>
          <AlertDescription>{t(`errors.${error}.desc`)}</AlertDescription>
        </Alert>
      )}

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
                  isEmail ? (
                    <Link
                      className="text-primary hover:underline"
                      href="/login/reset-password"
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

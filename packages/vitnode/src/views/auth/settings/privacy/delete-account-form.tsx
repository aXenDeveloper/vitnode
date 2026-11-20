import { Trash2Icon } from "lucide-react";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { AutoForm, setFormFieldError } from "@/components/form/auto-form";
import { AutoFormCheckbox } from "@/components/form/fields/checkbox";
import { AutoFormInput } from "@/components/form/fields/input";

import type { RequestAccountDeletionResult } from "./privacy-query";

/** The confirmation form in the "Delete account" dialog. Lazy-loaded. */
export const DeleteAccountForm = ({
  hasPassword,
  onSubmit,
}: {
  hasPassword: boolean;
  onSubmit: (values: {
    password?: string;
  }) => Promise<RequestAccountDeletionResult>;
}) => {
  const t = useTranslations("core.auth.settings.privacy.delete");
  const formSchema = z.object({
    ...(hasPassword
      ? { password: z.string().min(1, t("password_invalid")).default("") }
      : {}),
    understand: z
      .boolean()
      .default(false)
      .refine(value => value, t("understand_required")),
  });

  return (
    <AutoForm
      fields={[
        ...(hasPassword
          ? [
              {
                id: "password",
                component: props => (
                  <AutoFormInput
                    {...props}
                    autoComplete="current-password"
                    label={t("password")}
                    type="password"
                  />
                ),
              },
            ]
          : []),
        {
          id: "understand",
          component: props => (
            <AutoFormCheckbox {...props} label={t("understand")} />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={async (values, form) => {
        const password =
          "password" in values && typeof values.password === "string"
            ? values.password
            : undefined;
        const result = await onSubmit({ password });
        if (!result.ok && result.error === "invalid_password") {
          setFormFieldError(form, "password", t("password_invalid"));
        }
      }}
      submitButtonProps={{
        children: (
          <>
            <Trash2Icon aria-hidden="true" />
            {t("confirm")}
          </>
        ),
        variant: "destructive",
      }}
    />
  );
};

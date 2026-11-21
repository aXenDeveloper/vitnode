import { useSelector } from "@tanstack/react-form";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "use-intl";
import { z } from "zod";

import {
  AutoForm,
  AutoFormSubmitButton,
  setFormFieldError,
} from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";
import {
  AlertDialogCancel,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { useFormApi } from "@/components/ui/form";

import type { RequestAccountDeletionResult } from "./privacy-query";

const DeleteAccountActions = () => {
  const t = useTranslations("core.auth.settings.privacy.delete");
  const tGlobal = useTranslations("core.global");
  const { form } = useFormApi();
  const isSubmitting = useSelector(form.store, state => state.isSubmitting);

  return (
    <AlertDialogFooter className="group-data-[size=sm]/alert-dialog-content:flex sm:group-data-[size=sm]/alert-dialog-content:grid">
      <AlertDialogCancel
        className="w-full"
        disabled={isSubmitting}
        size="lg"
        variant="outline"
      >
        {tGlobal("cancel")}
      </AlertDialogCancel>
      <AutoFormSubmitButton className="h-10 w-full" variant="destructive">
        <Trash2Icon aria-hidden="true" />
        {t("confirm")}
      </AutoFormSubmitButton>
    </AlertDialogFooter>
  );
};

export const DeleteAccountForm = ({
  hasPassword,
  onSubmit,
  userName,
}: {
  hasPassword: boolean;
  onSubmit: (values: {
    password?: string;
  }) => Promise<RequestAccountDeletionResult>;
  userName: string;
}) => {
  const t = useTranslations("core.auth.settings.privacy.delete");
  const formSchema = z.object({
    ...(hasPassword
      ? { password: z.string().min(1, t("password_required")).default("") }
      : {}),
    confirmName: z
      .string()
      .default("")
      .refine(value => value.trim() === userName, t("confirm_name_invalid")),
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
          id: "confirmName",
          component: props => (
            <AutoFormInput
              {...props}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              label={
                <span>
                  {t.rich("confirm_name", {
                    name: userName,
                    b: chunks => (
                      <strong className="font-semibold wrap-break-word">
                        {chunks}
                      </strong>
                    ),
                  })}
                </span>
              }
              spellCheck={false}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      layout={rendered => (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            {rendered.password}
            {rendered.confirmName}
          </div>
          <DeleteAccountActions />
        </div>
      )}
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
    />
  );
};

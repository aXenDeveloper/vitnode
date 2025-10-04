import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

import { useWrapperSignUp } from "../wrapper";
import { mutationApi } from "./mutation-api";

export const usePasswordZodSchema = () => {
  const t = useTranslations("core.auth.sign_up");
  const tError = useTranslations("core.global.errors");
  const invalidPassword = t("password.invalid");

  return z
    .string({
      message: tError("field_required"),
    })
    .regex(/^.{8,}$/, invalidPassword)
    .regex(/[A-Z]/, invalidPassword)
    .regex(/\d/, invalidPassword)
    .regex(/\W|_/, invalidPassword)
    .default("");
};

export const useFormSignUp = () => {
  const t = useTranslations("core.auth.sign_up");
  const tError = useTranslations("core.global.errors");
  const passwordSchema = usePasswordZodSchema();

  const formSchema = z.object({
    name: z
      .string({
        message: tError("field_required"),
      })
      .min(3, t("username.min_length"))
      .max(32, t("username.max_length"))
      .default(""),
    // .refine(value => nameRegex.test(value), t('name.invalid'))
    email: z
      .email({
        message: t("email.invalid"),
      })
      .default("test@test.com"),
    password: passwordSchema,
    terms: z
      .boolean()
      .refine(value => value, t("terms.required"))
      .default(false),
    newsletter: z.boolean().default(false).optional(),
  });

  const { setSendingEmail } = useWrapperSignUp();

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async (
    values,
    form,
    { captchaToken },
  ) => {
    const mutation = await mutationApi({ ...values, captchaToken });
    if (mutation.data) {
      if (!mutation.data.emailVerified) {
        setSendingEmail(mutation.data.email);
      }

      return;
    }

    const errorMessages = {
      "Email already exists": {
        field: "email",
        message: t("email.exists"),
      },
      "Name already exists": {
        field: "name",
        message: t("username.exists"),
      },
    } as const;

    const errorConfig =
      errorMessages[mutation.error as unknown as keyof typeof errorMessages];

    if (errorConfig) {
      form.setError(
        errorConfig.field,
        {
          type: "manual",
          message: errorConfig.message,
        },
        {
          shouldFocus: true,
        },
      );

      return;
    }

    toast.error(tError("title"), {
      description: tError("internal_server_error"),
    });
  };

  return { onSubmit, formSchema };
};

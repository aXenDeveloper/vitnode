import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

import { useDialog } from "@/components/ui/dialog";

import { mutationApi } from "./mutation-api";

export const useFormCreateUserAdmin = () => {
  const t = useTranslations("admin.user.create");
  const tError = useTranslations("core.global.errors");
  const { setOpen, setIsDirty } = useDialog();

  const formSchema = z.object({
    name: z
      .string({ message: tError("field_required") })
      .min(3, t("name.min_length"))
      .max(32, t("name.max_length"))
      .default(""),
    email: z.email({ message: t("email.invalid") }).default(""),
    password: z
      .string({ message: tError("field_required") })
      .min(8, t("password.invalid"))
      .default(""),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async (
    values,
    form,
  ) => {
    const mutation = await mutationApi(values);

    if (mutation.data) {
      setIsDirty?.(false);
      setOpen?.(false);
      toast.success(t("success", { name: mutation.data.name }));

      return;
    }

    const errorMessages = {
      "Email already exists": {
        field: "email",
        message: t("email.exists"),
      },
      "Name already exists": {
        field: "name",
        message: t("name.exists"),
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

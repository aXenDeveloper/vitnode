import { useTranslations } from "next-intl";
import React from "react";
import { toast } from "sonner";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

import { mutationApi } from "./mutation-api";

export const useFormSignIn = ({ isAdmin = false }: { isAdmin?: boolean }) => {
  const [error, setError] = React.useState<"" | "access_denied">("");
  const t = useTranslations<"core.auth.sign_in">("core.auth.sign_in");
  const tErrors = useTranslations("core.global.errors");
  const formSchema = z.object({
    email: z.email({ message: t("email.invalid") }).default(""),
    password: z
      .string()
      .min(1, { message: t("password.required") })
      .default(""),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    setError("");
    const mutation = await mutationApi({ ...values, isAdmin });

    if (!mutation?.message) return;
    if (mutation?.message !== "Internal Server Error") {
      setError(mutation.message);

      return;
    }

    toast.error(tErrors("title"), {
      description: tErrors("internal_server_error"),
    });
  };

  return { onSubmit, error, formSchema };
};

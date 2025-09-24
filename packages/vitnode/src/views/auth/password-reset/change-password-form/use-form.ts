import { useTranslations } from "next-intl";
import { toast } from "sonner";
import z from "zod";

import { useRouter } from "@/lib/navigation";

import type { ChangePasswordForm } from "./form";

import { usePasswordZodSchema } from "../../sign-up/form/use-form";
import { mutationApi } from "./mutation-api";

export const useForm = ({
  token,
  userId,
}: React.ComponentProps<typeof ChangePasswordForm>) => {
  const t = useTranslations("core.auth.change_password");
  const tError = useTranslations("core.global.errors");
  const passwordSchema = usePasswordZodSchema();
  const { replace } = useRouter();

  const formSchema = z.object({
    password: passwordSchema,
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    const mutation = await mutationApi({
      password: data.password,
      token,
      userId: +userId,
    });

    if (mutation?.error) {
      toast.error(tError("title"), {
        description: tError("internal_server_error"),
      });

      return;
    }

    toast.success(t("success.title"), {
      description: t("success.desc"),
    });
    replace("/login");
  };

  return {
    formSchema,
    onSubmit,
  };
};

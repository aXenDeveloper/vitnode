import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

import { useDialog } from "@/components/ui/dialog";

import type { SendTestEmail } from "./send-test-email-mutation";

export const useFormSendTestEmail = (onSend: SendTestEmail) => {
  const t = useTranslations("admin.system.integrations.email.test");
  const tError = useTranslations("core.global.errors");
  const { setOpen, setIsDirty } = useDialog();

  const formSchema = z.object({
    to: z.email({ message: t("to.invalid") }).default(""),
    subject: z
      .string({ message: tError("field_required") })
      .min(1, tError("field_required"))
      .max(200)
      .default(t("subject.default")),
    content: z
      .string({ message: tError("field_required") })
      .min(1, tError("field_required"))
      .max(5000)
      .default(t("content.default")),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const mutation = await onSend(values);

    if (mutation.data) {
      setIsDirty?.(false);
      setOpen?.(false);
      toast.success(t("success"));

      return;
    }

    toast.error(tError("title"), {
      description: tError("internal_server_error"),
    });
  };

  return { onSubmit, formSchema };
};

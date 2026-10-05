import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";
import { useDialog } from "@/components/ui/dialog";
import { setFormFieldError } from "@/components/ui/form";

import type { UpdateAdminUser } from "./user-fields-content";

export const NameCodeForm = ({
  id,
  nameCode,
  onUpdate,
}: {
  id: number;
  nameCode: string;
  onUpdate: UpdateAdminUser;
}) => {
  const t = useTranslations("admin.user.show");
  const tError = useTranslations("core.global.errors");
  const { setIsDirty, setOpen } = useDialog();

  const formSchema = z.object({
    currentNameCode: z
      .string({ message: tError("field_required") })
      .refine(value => value === nameCode, t("nameCodeConfirmMismatch"))
      .default(""),
    newNameCode: z
      .string({ message: tError("field_required") })
      .min(3, tError("field_min_length", { min: 3 }))
      .max(255)
      .regex(/^[a-zA-Z0-9-]+$/, t("nameCodeInvalid"))
      .refine(value => value !== nameCode, t("nameCodeSame"))
      .default(""),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async (
    values,
    form,
  ) => {
    const result = await onUpdate(id, { nameCode: values.newNameCode });

    if ("data" in result) {
      setIsDirty?.(false);
      setOpen?.(false);
      toast.success(t("updateSuccess"));

      return;
    }

    if (result.error.status === 409) {
      setFormFieldError(form, "newNameCode", t("nameCodeExists"));

      return;
    }

    toast.error(tError("title"), {
      description: tError("internal_server_error"),
    });
  };

  return (
    <AutoForm
      fields={[
        {
          component: props => (
            <AutoFormInput
              autoComplete="off"
              label={t.rich("confirmNameCode", {
                bold: chunks => <span className="font-semibold">{chunks}</span>,
                nameCode: () => <code className="font-mono">{nameCode}</code>,
              })}
              {...props}
            />
          ),
          id: "currentNameCode",
        },
        {
          component: props => (
            <AutoFormInput label={t("newNameCode")} {...props} />
          ),
          id: "newNameCode",
        },
      ]}
      formSchema={formSchema}
      mode="all"
      onSubmit={onSubmit}
      submitButtonProps={{
        children: t("saveNameCode"),
        variant: "destructive",
      }}
    />
  );
};

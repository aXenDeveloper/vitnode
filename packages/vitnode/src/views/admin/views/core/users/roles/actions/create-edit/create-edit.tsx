import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { z } from "zod";

import { AutoForm, type AutoFormOnSubmit } from "@/components/form/auto-form";
import { AutoFormColor } from "@/components/form/fields/color";
import { AutoFormInput } from "@/components/form/fields/input";
import { useDialog } from "@/components/ui/dialog";
import { multiLangValueSchema } from "@/lib/helpers/multi-lang";
import { usePathname, useRouter } from "@/lib/navigation";

import { createRole, editRole } from "./mutation-api";

export interface RoleData {
  color: null | string;
  id: number;
  name: { languageCode: string; name: string }[];
}

export const CreateEditRoleAdmin = ({ data }: { data?: RoleData }) => {
  const t = useTranslations("admin.role");
  const tCore = useTranslations("core.global.errors");
  const { setOpen } = useDialog();
  const { push } = useRouter();
  const pathname = usePathname();

  const formSchema = z.object({
    name: multiLangValueSchema({ minLength: 1, maxLength: 255 })
      .min(1)
      .default(
        data?.name.map(item => ({
          languageCode: item.languageCode,
          value: item.name,
        })) ?? [],
      ),
    color: z
      .string()
      .max(50)
      .default(data?.color ?? ""),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const mutation = data?.id
      ? await editRole({ id: data.id, ...values })
      : await createRole(values);

    if (mutation?.error) {
      toast.error(tCore("title"), {
        description: tCore("internal_server_error"),
      });

      return;
    }

    toast.success(t(data ? "edit.success" : "create.success"));
    setOpen?.(false);
    push(pathname);
  };

  return (
    <AutoForm
      fields={[
        {
          id: "name",
          component: props => (
            <AutoFormInput label={t("form.name")} multiLang {...props} />
          ),
        },
        {
          id: "color",
          component: props => (
            <AutoFormColor
              allowRemoveColor
              label={t("form.color")}
              {...props}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButtonProps={{
        children: t(`${data ? "edit" : "create"}.submit`),
      }}
    />
  );
};

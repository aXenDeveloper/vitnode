import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { z } from "zod";

import { AutoForm, type AutoFormOnSubmit } from "@/components/form/auto-form";
import { AutoFormColor } from "@/components/form/fields/color";
import { AutoFormInput } from "@/components/form/fields/input";
import { AutoFormNullableNumber } from "@/components/form/fields/nullable-number";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { useDialog } from "@/components/ui/dialog";
import { multiLangValueSchema } from "@/lib/helpers/multi-lang";
import { usePathname, useRouter } from "@/lib/navigation";

import { createRole, editRole } from "./mutation-api.server";

export interface RoleData {
  allowUploadFiles: boolean;
  color: null | string;
  id: number;
  maxStorageForSubmit: null | number;
  name: { languageCode: string; name: string }[];
  totalMaxStorage: null | number;
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
    allowUploadFiles: z.boolean().default(data?.allowUploadFiles ?? false),
    // `null` means unlimited. Values are stored in kB.
    totalMaxStorage: z
      .number()
      .int()
      .min(0)
      .nullable()
      .default(data?.totalMaxStorage ?? null),
    maxStorageForSubmit: z
      .number()
      .int()
      .min(0)
      .nullable()
      .default(data?.maxStorageForSubmit ?? null)
      .describe(t("form.upload.max_storage_for_submit_desc")),
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
          tab: "general",
          component: props => (
            <AutoFormInput label={t("form.name")} multiLang {...props} />
          ),
        },
        {
          id: "color",
          tab: "general",
          component: props => (
            <AutoFormColor
              allowRemoveColor
              label={t("form.color")}
              {...props}
            />
          ),
        },
        {
          id: "allowUploadFiles",
          tab: "content",
          component: props => (
            <AutoFormSwitch label={t("form.upload.allow")} {...props} />
          ),
        },
        {
          id: "totalMaxStorage",
          tab: "content",
          hidden: values => !values.allowUploadFiles,
          component: props => (
            <AutoFormNullableNumber
              label={t("form.upload.total_max_storage")}
              min={0}
              orLabel={t("form.upload.or")}
              toggleLabel={t("form.upload.unlimited")}
              unitLabel={t("form.upload.in_unit")}
              {...props}
            />
          ),
        },
        {
          id: "maxStorageForSubmit",
          tab: "content",
          hidden: values => !values.allowUploadFiles,
          component: props => (
            <AutoFormNullableNumber
              label={t("form.upload.max_storage_for_submit")}
              min={0}
              orLabel={t("form.upload.or")}
              toggleLabel={t("form.upload.unlimited")}
              unitLabel={t("form.upload.in_unit")}
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
      tabs={[
        { value: "general", label: t("tabs.general") },
        { value: "content", label: t("tabs.content") },
      ]}
    />
  );
};

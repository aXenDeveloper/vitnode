"use client";

import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormColor } from "@/components/form/fields/color";
import { AutoFormInput } from "@/components/form/fields/input";
import { AutoFormNullableNumber } from "@/components/form/fields/nullable-number";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { useDialog } from "@/components/ui/dialog";
import { multiLangValueSchema } from "@/lib/helpers/multi-lang";

/**
 * Creating and editing a role, as one form both frameworks mount.
 *
 * The Next.js version of this component reached for two things a package cannot
 * assume: `next-intl`'s `useTranslations`, and a `"use server"` module. The
 * strings now come from `use-intl` - the context `NextIntlClientProvider` and
 * `RouteMessages` both provide - and the write arrives as a prop, so a Next.js
 * page can keep handing it a Server Action while a TanStack route hands it a
 * browser call.
 *
 * `onSaved` is separate from `onSave` on purpose. The write and *what the
 * application does about it* are different questions with different answers per
 * framework: Next.js revalidates a path inside its action and then re-renders
 * the pathname, while TanStack invalidates a query key. Neither belongs in a
 * form.
 */

/** The shape the roles API takes, as the form produces it. */
export interface AdminRoleFormValues {
  allowUploadFiles: boolean;
  color: string;
  maxStorageForSubmit: null | number;
  name: { languageCode: string; value: string }[];
  totalMaxStorage: null | number;
}

/** The row an edit re-opens with. Absent for a create. */
export interface AdminRoleFormData {
  allowUploadFiles: boolean;
  color: null | string;
  id: number;
  maxStorageForSubmit: null | number;
  name: { languageCode: string; name: string }[];
  totalMaxStorage: null | number;
}

export interface AdminRoleFormProps {
  data?: AdminRoleFormData;
  /** Performs the write. `id` is present exactly when this is an edit. */
  onSave: (args: {
    id?: number;
    values: AdminRoleFormValues;
  }) => Promise<AdminMutationResult<unknown>>;
  /** Called once, after a save the API accepted. */
  onSaved?: () => void;
}

export const AdminRoleFormContent = ({
  data,
  onSave,
  onSaved,
}: AdminRoleFormProps) => {
  const t = useTranslations("admin.role");
  const tCore = useTranslations("core.global.errors");
  const { setIsDirty, setOpen } = useDialog();

  const formSchema = z.object({
    allowUploadFiles: z.boolean().default(data?.allowUploadFiles ?? false),
    color: z
      .string()
      .max(50)
      .default(data?.color ?? ""),
    maxStorageForSubmit: z
      .number()
      .int()
      .min(0)
      .nullable()
      .default(data?.maxStorageForSubmit ?? null)
      .describe(t("form.upload.max_storage_for_submit_desc")),
    name: multiLangValueSchema({ maxLength: 255, minLength: 1 })
      .min(1)
      .default(
        data?.name.map(item => ({
          languageCode: item.languageCode,
          value: item.name,
        })) ?? [],
      ),
    totalMaxStorage: z
      .number()
      .int()
      .min(0)
      .nullable()
      .default(data?.totalMaxStorage ?? null),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const result = await onSave({ id: data?.id, values });

    if ("error" in result) {
      toast.error(tCore("title"), {
        description: tCore("internal_server_error"),
      });

      return;
    }

    toast.success(t(data ? "edit.success" : "create.success"));
    setIsDirty?.(false);
    setOpen?.(false);
    onSaved?.();
  };

  return (
    <AutoForm
      fields={[
        {
          component: props => (
            <AutoFormInput label={t("form.name")} multiLang {...props} />
          ),
          id: "name",
          tab: "general",
        },
        {
          component: props => (
            <AutoFormColor
              allowRemoveColor
              label={t("form.color")}
              {...props}
            />
          ),
          id: "color",
          tab: "general",
        },
        {
          component: props => (
            <AutoFormSwitch label={t("form.upload.allow")} {...props} />
          ),
          id: "allowUploadFiles",
          tab: "content",
        },
        {
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
          hidden: values => !values.allowUploadFiles,
          id: "totalMaxStorage",
          tab: "content",
        },
        {
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
          hidden: values => !values.allowUploadFiles,
          id: "maxStorageForSubmit",
          tab: "content",
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButtonProps={{
        children: t(`${data ? "edit" : "create"}.submit`),
      }}
      tabs={[
        { label: t("tabs.general"), value: "general" },
        { label: t("tabs.content"), value: "content" },
      ]}
    />
  );
};

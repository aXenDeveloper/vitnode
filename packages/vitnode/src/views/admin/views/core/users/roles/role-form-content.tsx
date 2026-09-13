import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormColor } from "@/components/form/fields/color";
import { AutoFormEmojiIcon } from "@/components/form/fields/emoji-icon";
import { AutoFormInput } from "@/components/form/fields/input";
import { AutoFormNullableNumber } from "@/components/form/fields/nullable-number";
import { AutoFormNumber } from "@/components/form/fields/number";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { useDialog } from "@/components/ui/dialog";
import { EMOJI_ICON_MAX_LENGTH } from "@/lib/emoji-icon";
import { multiLangValueSchema } from "@/lib/helpers/multi-lang";

export const ROLE_IMAGE_SIZE_MAX_KB = 1024 * 1024;
export const ROLE_DEFAULT_AVATAR_SIZE_KB = 2048;
export const ROLE_DEFAULT_COVER_SIZE_KB = 5120;

/** The shape the roles API takes, as the form produces it. */
export interface AdminRoleFormValues {
  allowEditPersonalInfo: boolean;
  allowUploadAvatar: boolean;
  allowUploadCover: boolean;
  allowUploadFiles: boolean;
  color: string;
  maxAvatarSize: number;
  maxCoverSize: number;
  maxStorageForSubmit: null | number;
  name: { languageCode: string; value: string }[];
  prefix: string;
  totalMaxStorage: null | number;
}

/** The row an edit re-opens with. Absent for a create. */
export interface AdminRoleFormData {
  allowEditPersonalInfo: boolean;
  allowUploadAvatar: boolean;
  allowUploadCover: boolean;
  allowUploadFiles: boolean;
  color: null | string;
  id: number;
  maxAvatarSize: number;
  maxCoverSize: number;
  maxStorageForSubmit: null | number;
  name: { languageCode: string; name: string }[];
  prefix: null | string;
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

  const imageSizeSchema = (fallback: number) =>
    z
      .number({ message: tCore("field_required") })
      .int()
      .min(1)
      .max(ROLE_IMAGE_SIZE_MAX_KB)
      .default(fallback);

  const formSchema = z.object({
    allowEditPersonalInfo: z
      .boolean()
      .default(data?.allowEditPersonalInfo ?? true),
    allowUploadAvatar: z.boolean().default(data?.allowUploadAvatar ?? true),
    allowUploadCover: z.boolean().default(data?.allowUploadCover ?? true),
    allowUploadFiles: z.boolean().default(data?.allowUploadFiles ?? false),
    maxAvatarSize: imageSizeSchema(
      data?.maxAvatarSize ?? ROLE_DEFAULT_AVATAR_SIZE_KB,
    ).describe(t("form.images.avatar.max_size_desc")),
    maxCoverSize: imageSizeSchema(
      data?.maxCoverSize ?? ROLE_DEFAULT_COVER_SIZE_KB,
    ).describe(t("form.images.cover.max_size_desc")),
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
    prefix: z
      .string()
      .max(EMOJI_ICON_MAX_LENGTH)
      .default(data?.prefix ?? "")
      .describe(t("form.prefix_desc")),
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
            <AutoFormEmojiIcon
              allowRemove
              label={t("form.prefix")}
              {...props}
            />
          ),
          id: "prefix",
          tab: "general",
        },
        {
          children: [
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
              id: "totalMaxStorage",
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
              id: "maxStorageForSubmit",
            },
          ],
          component: props => (
            <AutoFormSwitch label={t("form.upload.allow")} {...props} />
          ),
          id: "allowUploadFiles",
          tab: "content",
        },
        {
          component: props => (
            <AutoFormSwitch
              {...props}
              description={t("form.personal_info.allow_edit_desc")}
              label={t("form.personal_info.allow_edit")}
            />
          ),
          id: "allowEditPersonalInfo",
          tab: "profile",
        },
        {
          children: [
            {
              component: props => (
                <AutoFormNumber
                  label={t("form.images.avatar.max_size")}
                  max={ROLE_IMAGE_SIZE_MAX_KB}
                  min={1}
                  step={1}
                  unitLabel={t("form.images.in_unit")}
                  {...props}
                />
              ),
              id: "maxAvatarSize",
            },
          ],
          component: props => (
            <AutoFormSwitch label={t("form.images.avatar.allow")} {...props} />
          ),
          id: "allowUploadAvatar",
          tab: "profile",
        },
        {
          children: [
            {
              component: props => (
                <AutoFormNumber
                  label={t("form.images.cover.max_size")}
                  max={ROLE_IMAGE_SIZE_MAX_KB}
                  min={1}
                  step={1}
                  unitLabel={t("form.images.in_unit")}
                  {...props}
                />
              ),
              id: "maxCoverSize",
            },
          ],
          component: props => (
            <AutoFormSwitch label={t("form.images.cover.allow")} {...props} />
          ),
          id: "allowUploadCover",
          tab: "profile",
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
        { label: t("tabs.profile"), value: "profile" },
      ]}
    />
  );
};

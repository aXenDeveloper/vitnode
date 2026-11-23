import { useSuspenseQuery } from "@tanstack/react-query";
import { AI_ACTION_LIMITS } from "@vitnode/api/lib/ai/action";
import { EMOJI_ICON_MAX_LENGTH } from "@vitnode/api/lib/emoji-icon";
import { multiLangValueSchema } from "@vitnode/api/lib/helpers/multi-lang";
import {
  ROLE_DEFAULT_MAX_MENTIONS_PER_ITEM,
  ROLE_MAX_MENTIONS_PER_ITEM,
} from "@vitnode/api/lib/mentions/limits";
import { ROLE_EDIT_OWN_CONTENT_MAX_MINUTES } from "@vitnode/api/lib/own-content";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type {
  AutoFormOnSubmit,
  ItemAutoFormComponentProps,
} from "@/components/form/auto-form";
import type { AdminAiRoleAccessInput } from "@/views/admin/views/core/ai/ai-mutations";
import type {
  AdminAiRoleAccess,
  adminAiRoleAccessQueryOptions,
} from "@/views/admin/views/core/ai/ai-query";
import type { AdminRoleReactionsInput } from "@/views/admin/views/core/reactions/reactions-mutations";
import type { AdminRoleReactions } from "@/views/admin/views/core/reactions/reactions-query";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormColor } from "@/components/form/fields/color";
import { AutoFormEmojiIcon } from "@/components/form/fields/emoji-icon";
import { AutoFormInput } from "@/components/form/fields/input";
import { AutoFormNullableNumber } from "@/components/form/fields/nullable-number";
import { AutoFormNumber } from "@/components/form/fields/number";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { useDialog } from "@/components/ui/dialog";
import {
  type AiActionTranslate,
  withTranslatedAiActionText,
} from "@/lib/ai/action-text";
import { useAdminIdentity } from "@/tanstack/admin/identity";
import {
  fromAiDecimal,
  toAiDecimal,
} from "@/views/admin/views/core/ai/ai-decimal";
import { adminRoleReactionsQueryOptions } from "@/views/admin/views/core/reactions/reactions-query";

import { AutoFormAiPermission } from "./ai-permission-field";
import {
  roleReactionsFields,
  roleReactionsShape,
  roleReactionsValuesOf,
} from "./role-reactions-fields";

export const ROLE_IMAGE_SIZE_MAX_KB = 1024 * 1024;
export const ROLE_DEFAULT_AVATAR_SIZE_KB = 2048;
export const ROLE_DEFAULT_COVER_SIZE_KB = 5120;

const AI_GRANTS = ["default", "allow", "deny"] as const;
type AiGrantChoice = (typeof AI_GRANTS)[number];

const aiGrantId = (index: number) => `aiGrant_${index}`;
const aiLimitId = (index: number) => `aiLimit_${index}`;

const aiGrantChoiceOf = (granted: boolean | undefined): AiGrantChoice =>
  granted === undefined ? "default" : granted ? "allow" : "deny";

const isAiGrantChoice = (value: unknown): value is AiGrantChoice =>
  AI_GRANTS.some(choice => choice === value);

export type AdminRoleAiValues = Omit<AdminAiRoleAccessInput, "roleId">;

/** The shape the roles API takes, as the form produces it. */
export interface AdminRoleFormValues {
  ai?: AdminRoleAiValues;
  allowBrowseAnonymously: boolean;
  allowDeleteAccount?: boolean;
  allowDeleteOwnContent: boolean;
  allowEditOwnContent: boolean;
  allowEditPersonalInfo: boolean;
  allowHideOwnContent: boolean;
  allowMentions: boolean;
  allowUploadAvatar: boolean;
  allowUploadCover: boolean;
  allowUploadFiles: boolean;
  color: string;
  editOwnContentMinutes: null | number;
  forceBrowseAnonymously: boolean;
  maxAvatarSize: number;
  maxCoverSize: number;
  maxMentionsPerItem: null | number;
  maxStorageForSubmit: null | number;
  name: { languageCode: string; value: string }[];
  prefix: string;
  /** The Reactions tab, saved with `PUT /admin/reactions/roles/{roleId}`. */
  reactions?: AdminRoleReactionsInput;
  totalMaxStorage: null | number;
}

/** The row an edit re-opens with. Absent for a create. */
export interface AdminRoleFormData {
  allowBrowseAnonymously: boolean;
  allowDeleteAccount?: boolean;
  allowDeleteOwnContent: boolean;
  allowEditOwnContent: boolean;
  allowEditPersonalInfo: boolean;
  allowHideOwnContent: boolean;
  allowMentions: boolean;
  allowUploadAvatar: boolean;
  allowUploadCover: boolean;
  allowUploadFiles: boolean;
  color: null | string;
  editOwnContentMinutes: null | number;
  forceBrowseAnonymously: boolean;
  id: number;
  maxAvatarSize: number;
  maxCoverSize: number;
  maxMentionsPerItem: null | number;
  maxStorageForSubmit: null | number;
  name: { languageCode: string; name: string }[];
  prefix: null | string;
  totalMaxStorage: null | number;
}

export interface AdminRoleFormProps {
  ai?: AdminAiRoleAccess;
  data?: AdminRoleFormData;
  /** Performs the write. `id` is present exactly when this is an edit. */
  onSave: (args: {
    id?: number;
    values: AdminRoleFormValues;
  }) => Promise<AdminMutationResult<unknown>>;
  /** Called once, after a save the API accepted. */
  onSaved?: () => void;
  /** The role's reaction settings; adds the Reactions tab. */
  reactions?: AdminRoleReactions;
}

const aiShape = (
  ai: AdminAiRoleAccess | undefined,
): Record<string, z.ZodType> => {
  if (!ai) return {};
  const grantOf = (key: string) =>
    ai.role?.grants.find(grant => grant.permission === key);

  return {
    aiUnlimited: z.boolean().default(ai.role?.unlimited ?? false),
    aiMonthlyPoints: z
      .number()
      .min(0)
      .nullable()
      .default(fromAiDecimal(ai.role?.monthlyPoints ?? null)),
    ...Object.fromEntries(
      ai.permissions.flatMap((permission, index) => [
        [
          aiGrantId(index),
          z
            .enum(AI_GRANTS)
            .default(aiGrantChoiceOf(grantOf(permission.key)?.granted)),
        ],
        [
          aiLimitId(index),
          z
            .number()
            .int()
            .min(AI_ACTION_LIMITS.dailyLimit.min)
            .max(AI_ACTION_LIMITS.dailyLimit.max)
            .nullable()
            .default(grantOf(permission.key)?.dailyLimit ?? null),
        ],
      ]),
    ),
  };
};

const aiValuesOf = (
  ai: AdminAiRoleAccess,
  values: Record<string, unknown>,
): AdminRoleAiValues => {
  const points = values.aiMonthlyPoints;

  return {
    grants: ai.permissions.map((permission, index) => {
      const choice = values[aiGrantId(index)];
      const limit = values[aiLimitId(index)];
      const granted =
        !isAiGrantChoice(choice) || choice === "default"
          ? null
          : choice === "allow";

      return {
        dailyLimit: granted && typeof limit === "number" ? limit : null,
        granted,
        permission: permission.key,
      };
    }),
    monthlyPoints: typeof points === "number" ? toAiDecimal(points) : null,
    unlimited: values.aiUnlimited === true,
  };
};

const aiFields = (
  ai: AdminAiRoleAccess,
  t: ReturnType<typeof useTranslations<"admin.role">>,
  tAll: AiActionTranslate,
) => [
  {
    component: (props: ItemAutoFormComponentProps) => (
      <AutoFormSwitch
        {...props}
        description={t("form.ai.unlimited_desc")}
        label={t("form.ai.unlimited")}
      />
    ),
    id: "aiUnlimited",
    tab: "ai",
  },
  {
    component: (props: ItemAutoFormComponentProps) => (
      <AutoFormNullableNumber
        {...props}
        description={t("form.ai.monthly_points_desc")}
        label={t("form.ai.monthly_points")}
        min={0}
        orLabel={t("form.ai.or")}
        step={1}
        toggleLabel={t("form.ai.site_default")}
        unitLabel={t("form.ai.points_unit")}
      />
    ),
    hidden: (values: Record<string, unknown>) => values.aiUnlimited === true,
    id: "aiMonthlyPoints",
    tab: "ai",
  },
  ...ai.permissions.map((permission, index) => ({
    children: [
      {
        component: (props: ItemAutoFormComponentProps) => (
          <AutoFormNullableNumber
            {...props}
            label={t("form.ai.daily_limit")}
            min={0}
            orLabel={t("form.ai.or")}
            step={1}
            toggleLabel={t("form.ai.action_default")}
            unitLabel={t("form.ai.per_day")}
          />
        ),
        id: aiLimitId(index),
      },
    ],
    component: (props: ItemAutoFormComponentProps) => (
      <AutoFormAiPermission
        {...props}
        labels={[
          {
            label: permission.defaultGranted
              ? t("form.ai.grant.default_allowed")
              : t("form.ai.grant.default_denied"),
            value: "default",
          },
          { label: t("form.ai.grant.allow"), value: "allow" },
          { label: t("form.ai.grant.deny"), value: "deny" },
        ]}
        permission={{
          ...permission,
          actions: permission.actions.map(action =>
            withTranslatedAiActionText(tAll, action),
          ),
        }}
      />
    ),
    id: aiGrantId(index),
    tab: "ai",
  })),
];

export const AdminRoleFormContent = ({
  ai,
  data,
  onSave,
  onSaved,
  reactions,
}: AdminRoleFormProps) => {
  const t = useTranslations("admin.role");
  const tAll = useTranslations() as unknown as AiActionTranslate;
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
    allowEditOwnContent: z.boolean().default(data?.allowEditOwnContent ?? true),
    allowDeleteOwnContent: z
      .boolean()
      .default(data?.allowDeleteOwnContent ?? false),
    allowHideOwnContent: z
      .boolean()
      .default(data?.allowHideOwnContent ?? false),
    editOwnContentMinutes: z
      .number()
      .int()
      .min(1)
      .max(ROLE_EDIT_OWN_CONTENT_MAX_MINUTES)
      .nullable()
      .default(data?.editOwnContentMinutes ?? null)
      .describe(t("form.edit_own_content.minutes_desc")),
    allowMentions: z.boolean().default(data?.allowMentions ?? true),
    maxMentionsPerItem: z
      .number()
      .int()
      .min(1)
      .max(ROLE_MAX_MENTIONS_PER_ITEM)
      .nullable()
      .default(
        data ? data.maxMentionsPerItem : ROLE_DEFAULT_MAX_MENTIONS_PER_ITEM,
      )
      .describe(t("form.mentions.max_per_item_desc")),
    allowEditPersonalInfo: z
      .boolean()
      .default(data?.allowEditPersonalInfo ?? true),
    allowDeleteAccount: z.boolean().default(data?.allowDeleteAccount ?? true),
    allowBrowseAnonymously: z
      .boolean()
      .default(data?.allowBrowseAnonymously ?? true),
    forceBrowseAnonymously: z
      .boolean()
      .default(data?.forceBrowseAnonymously ?? false),
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
    ...aiShape(ai),
    ...roleReactionsShape(reactions),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const result = await onSave({
      id: data?.id,
      values: {
        ...values,
        ai: ai ? aiValuesOf(ai, values) : undefined,
        reactions: reactions ? roleReactionsValuesOf(values) : undefined,
      },
    });

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
          children: [
            {
              component: props => (
                <AutoFormNullableNumber
                  label={t("form.edit_own_content.minutes")}
                  max={ROLE_EDIT_OWN_CONTENT_MAX_MINUTES}
                  min={1}
                  orLabel={t("form.edit_own_content.or")}
                  resumeValue={60}
                  step={1}
                  toggleLabel={t("form.edit_own_content.unlimited")}
                  unitLabel={t("form.edit_own_content.in_unit")}
                  {...props}
                />
              ),
              id: "editOwnContentMinutes",
            },
          ],
          component: props => (
            <AutoFormSwitch
              {...props}
              label={t("form.edit_own_content.allow")}
            />
          ),
          id: "allowEditOwnContent",
          tab: "content",
        },
        {
          component: props => (
            <AutoFormSwitch
              {...props}
              label={t("form.delete_own_content.allow")}
            />
          ),
          id: "allowDeleteOwnContent",
          tab: "content",
        },
        {
          component: props => (
            <AutoFormSwitch
              {...props}
              label={t("form.hide_own_content.allow")}
            />
          ),
          id: "allowHideOwnContent",
          tab: "content",
        },
        {
          children: [
            {
              component: props => (
                <AutoFormNullableNumber
                  label={t("form.mentions.max_per_item")}
                  max={ROLE_MAX_MENTIONS_PER_ITEM}
                  min={1}
                  orLabel={t("form.mentions.or")}
                  resumeValue={ROLE_DEFAULT_MAX_MENTIONS_PER_ITEM}
                  step={1}
                  toggleLabel={t("form.mentions.unlimited")}
                  unitLabel={t("form.mentions.in_unit")}
                  {...props}
                />
              ),
              id: "maxMentionsPerItem",
            },
          ],
          component: props => (
            <AutoFormSwitch
              {...props}
              description={t("form.mentions.allow_desc")}
              label={t("form.mentions.allow")}
            />
          ),
          id: "allowMentions",
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
          component: props => (
            <AutoFormSwitch
              {...props}
              description={t("form.delete_account.allow_desc")}
              label={t("form.delete_account.allow")}
            />
          ),
          id: "allowDeleteAccount",
          tab: "profile",
        },
        {
          component: props => (
            <AutoFormSwitch
              {...props}
              description={t("form.browse_anonymously.allow_desc")}
              label={t("form.browse_anonymously.allow")}
            />
          ),
          id: "allowBrowseAnonymously",
          tab: "profile",
        },
        {
          component: props => (
            <AutoFormSwitch
              {...props}
              description={t("form.browse_anonymously.force_desc")}
              label={t("form.browse_anonymously.force")}
            />
          ),
          id: "forceBrowseAnonymously",
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
        ...(ai ? aiFields(ai, t, tAll) : []),
        ...(reactions ? roleReactionsFields(t) : []),
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
        ...(ai ? [{ label: t("tabs.ai"), value: "ai" }] : []),
        ...(reactions
          ? [{ label: t("tabs.reactions"), value: "reactions" }]
          : []),
      ]}
    />
  );
};

export type AdminRoleAiAccessQuery = (
  roleId: null | number,
) => ReturnType<typeof adminAiRoleAccessQueryOptions>;

const AdminRoleFormWithReactions = (
  props: Omit<AdminRoleFormProps, "reactions">,
) => {
  const adminUserId = useAdminIdentity();
  const { data } = useSuspenseQuery(
    adminRoleReactionsQueryOptions(adminUserId, props.data?.id ?? null),
  );

  return <AdminRoleFormContent reactions={data} {...props} />;
};

const AdminRoleFormWithAi = ({
  aiAccessQuery,
  ...props
}: Omit<AdminRoleFormProps, "ai" | "reactions"> & {
  aiAccessQuery: AdminRoleAiAccessQuery;
}) => {
  const { data } = useSuspenseQuery(aiAccessQuery(props.data?.id ?? null));

  return <AdminRoleFormWithReactions ai={data} {...props} />;
};

export const AdminRoleFormDialogContent = ({
  aiAccessQuery,
  ...props
}: Omit<AdminRoleFormProps, "ai" | "reactions"> & {
  aiAccessQuery?: AdminRoleAiAccessQuery;
}) =>
  aiAccessQuery ? (
    <AdminRoleFormWithAi aiAccessQuery={aiAccessQuery} {...props} />
  ) : (
    <AdminRoleFormWithReactions {...props} />
  );

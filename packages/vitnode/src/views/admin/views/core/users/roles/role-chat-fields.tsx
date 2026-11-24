import type { useTranslations } from "use-intl";

import { z } from "zod";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";

import { AutoFormNullableNumber } from "@/components/form/fields/nullable-number";
import { AutoFormSwitch } from "@/components/form/fields/switch";

const CHAT_LIMIT_MAX = 100_000;

/** What the Chat tab reads from a role. */
export interface AdminRoleChat {
  allowChat: boolean;
  chatForcePasscode?: boolean;
  chatMaxInvites: null | number;
  chatRequestsPerDay: null | number;
}

/** The Chat tab's part of the role form schema. */
export const roleChatShape = (data: AdminRoleChat | undefined) => ({
  allowChat: z.boolean().default(data?.allowChat ?? true),
  chatForcePasscode: z.boolean().default(data?.chatForcePasscode ?? false),
  chatRequestsPerDay: z
    .number()
    .int()
    .min(1)
    .max(CHAT_LIMIT_MAX)
    .nullable()
    .default(data ? data.chatRequestsPerDay : 20),
  chatMaxInvites: z
    .number()
    .int()
    .min(1)
    .max(CHAT_LIMIT_MAX)
    .nullable()
    .default(data ? data.chatMaxInvites : 10),
});

/** The Chat tab: can chat, new chats per day and people added at once. */
export const roleChatFields = (
  t: ReturnType<typeof useTranslations<"admin.role">>,
) => {
  const cannotChat = (values: Record<string, unknown>) =>
    values.allowChat !== true;

  return [
    {
      component: (props: ItemAutoFormComponentProps) => (
        <AutoFormSwitch
          {...props}
          description={t("form.chat.allow_desc")}
          label={t("form.chat.allow")}
        />
      ),
      id: "allowChat",
      tab: "chat",
    },
    {
      component: (props: ItemAutoFormComponentProps) => (
        <AutoFormNullableNumber
          {...props}
          description={t("form.chat.per_day_desc")}
          label={t("form.chat.per_day")}
          max={CHAT_LIMIT_MAX}
          min={1}
          orLabel={t("form.chat.or")}
          resumeValue={20}
          step={1}
          toggleLabel={t("form.chat.unlimited")}
          unitLabel={t("form.chat.per_day_unit")}
        />
      ),
      hidden: cannotChat,
      id: "chatRequestsPerDay",
      tab: "chat",
    },
    {
      component: (props: ItemAutoFormComponentProps) => (
        <AutoFormNullableNumber
          {...props}
          description={t("form.chat.max_invites_desc")}
          label={t("form.chat.max_invites")}
          max={CHAT_LIMIT_MAX}
          min={1}
          orLabel={t("form.chat.or")}
          resumeValue={10}
          step={1}
          toggleLabel={t("form.chat.up_to_group")}
          unitLabel={t("form.chat.max_invites_unit")}
        />
      ),
      hidden: cannotChat,
      id: "chatMaxInvites",
      tab: "chat",
    },
    {
      component: (props: ItemAutoFormComponentProps) => (
        <AutoFormSwitch
          {...props}
          description={t("form.chat.force_passcode_desc")}
          label={t("form.chat.force_passcode")}
        />
      ),
      hidden: cannotChat,
      id: "chatForcePasscode",
      tab: "chat",
    },
  ];
};

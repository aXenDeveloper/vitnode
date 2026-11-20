import type { useTranslations } from "use-intl";

import { Link } from "@tanstack/react-router";
import { REACTIONS_LIMITS } from "@vitnode/api/lib/reactions/const";
import { z } from "zod";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { AdminRoleReactionsInput } from "@/views/admin/views/core/reactions/reactions-mutations";
import type { AdminRoleReactions } from "@/views/admin/views/core/reactions/reactions-query";

import { AutoFormNullableNumber } from "@/components/form/fields/nullable-number";
import { AutoFormSwitch } from "@/components/form/fields/switch";

/** The Reactions tab's part of the role form schema. */
export const roleReactionsShape = (
  reactions: AdminRoleReactions | undefined,
): Record<string, z.ZodType> => {
  if (!reactions) return {};

  return {
    reactAllow: z.boolean().default(reactions.allowReact),
    reactAllowOwn: z.boolean().default(reactions.allowReactOwnContent),
    reactPerItem: z
      .number()
      .int()
      .min(1)
      .max(REACTIONS_LIMITS.maxPerItem)
      .nullable()
      .default(reactions.maxReactionsPerItem),
    reactPerDay: z
      .number()
      .int()
      .min(1)
      .max(REACTIONS_LIMITS.maxDailyLimit)
      .nullable()
      .default(reactions.reactionsPerDay),
  };
};

/** The Reactions tab's values, as `PUT /admin/reactions/roles/{roleId}` takes them. */
export const roleReactionsValuesOf = (
  values: Record<string, unknown>,
): AdminRoleReactionsInput => {
  const numberOrNull = (value: unknown) =>
    typeof value === "number" ? value : null;

  return {
    allowReact: values.reactAllow === true,
    allowReactOwnContent: values.reactAllowOwn === true,
    maxReactionsPerItem: numberOrNull(values.reactPerItem),
    reactionsPerDay: numberOrNull(values.reactPerDay),
  };
};

/**
 * The Reactions tab: can react, own content, per item and per day. Which
 * reactions the role can use, and each one's daily limit, live on the reaction.
 */
export const roleReactionsFields = (
  t: ReturnType<typeof useTranslations<"admin.role">>,
) => {
  const cannotReact = (values: Record<string, unknown>) =>
    values.reactAllow !== true;

  return [
    {
      component: (props: ItemAutoFormComponentProps) => (
        <AutoFormSwitch
          {...props}
          description={
            <>
              {t("form.reactions.allow_desc")}{" "}
              {t.rich("form.reactions.per_reaction_note", {
                link: chunks => (
                  <Link
                    className="text-foreground font-medium underline-offset-4 hover:underline"
                    to="/admin/core/users/reactions"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </>
          }
          label={t("form.reactions.allow")}
        />
      ),
      id: "reactAllow",
      tab: "reactions",
    },
    {
      component: (props: ItemAutoFormComponentProps) => (
        <AutoFormSwitch
          {...props}
          description={t("form.reactions.allow_own_desc")}
          label={t("form.reactions.allow_own")}
        />
      ),
      hidden: cannotReact,
      id: "reactAllowOwn",
      tab: "reactions",
    },
    {
      component: (props: ItemAutoFormComponentProps) => (
        <AutoFormNullableNumber
          {...props}
          description={t("form.reactions.per_item_desc")}
          label={t("form.reactions.per_item")}
          max={REACTIONS_LIMITS.maxPerItem}
          min={1}
          orLabel={t("form.reactions.or")}
          resumeValue={1}
          step={1}
          toggleLabel={t("form.reactions.unlimited")}
          unitLabel={t("form.reactions.per_item_unit")}
        />
      ),
      hidden: cannotReact,
      id: "reactPerItem",
      tab: "reactions",
    },
    {
      component: (props: ItemAutoFormComponentProps) => (
        <AutoFormNullableNumber
          {...props}
          description={t("form.reactions.per_day_desc")}
          label={t("form.reactions.per_day")}
          max={REACTIONS_LIMITS.maxDailyLimit}
          min={1}
          orLabel={t("form.reactions.or")}
          resumeValue={50}
          step={1}
          toggleLabel={t("form.reactions.unlimited")}
          unitLabel={t("form.reactions.per_day_unit")}
        />
      ),
      hidden: cannotReact,
      id: "reactPerDay",
      tab: "reactions",
    },
  ];
};

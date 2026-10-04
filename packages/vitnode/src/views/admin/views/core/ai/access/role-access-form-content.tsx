import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";
import { z } from "zod";

import type {
  AutoFormOnSubmit,
  ItemAutoFormComponentProps,
} from "@/components/form/auto-form";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { AI_ACTION_LIMITS } from "@/api/lib/ai/action";
import { AutoForm } from "@/components/form/auto-form";
import { AutoFormNullableNumber } from "@/components/form/fields/nullable-number";
import { AutoFormSelect } from "@/components/form/fields/select";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { resolveRoleName } from "@/components/role-name";
import { useDialog } from "@/components/ui/dialog";

import type { AdminAiRoleAccessInput } from "../ai-mutations";
import type { AdminAiAccess, AdminAiRoleAccess } from "../ai-query";

import { fromAiDecimal, toAiDecimal } from "../ai-decimal";

const GRANTS = ["default", "allow", "deny"] as const;
type GrantChoice = (typeof GRANTS)[number];

const grantId = (index: number) => `grant_${index}`;
const limitId = (index: number) => `limit_${index}`;

const grantChoiceOf = (granted: boolean | undefined): GrantChoice =>
  granted === undefined ? "default" : granted ? "allow" : "deny";

const isGrantChoice = (value: unknown): value is GrantChoice =>
  GRANTS.some(choice => choice === value);

export interface AiRoleAccessFormProps {
  describePermission: (key: string) => string;
  onSave: (body: AdminAiRoleAccessInput) => Promise<AdminMutationResult<true>>;
  permissions: AdminAiAccess["permissions"];
  role: AdminAiRoleAccess;
}

export const AiRoleAccessFormContent = ({
  describePermission,
  onSave,
  permissions,
  role,
}: AiRoleAccessFormProps) => {
  const t = useTranslations("admin.ai.access.role_form");
  const tError = useTranslations("core.global.errors");
  const locale = useLocale();
  const { setIsDirty, setOpen } = useDialog();

  const grantFields = Object.fromEntries(
    permissions.map((permission, index) => {
      const grant = role.grants.find(row => row.permission === permission.key);

      return [
        grantId(index),
        z.enum(GRANTS).default(grantChoiceOf(grant?.granted)),
      ];
    }),
  );
  const limitFields = Object.fromEntries(
    permissions.map((permission, index) => {
      const grant = role.grants.find(row => row.permission === permission.key);

      return [
        limitId(index),
        z
          .number()
          .int()
          .min(AI_ACTION_LIMITS.dailyLimit.min)
          .max(AI_ACTION_LIMITS.dailyLimit.max)
          .nullable()
          .default(grant?.dailyLimit ?? null),
      ];
    }),
  );

  const formSchema = z.object({
    unlimited: z.boolean().default(role.unlimited),
    monthlyPoints: z
      .number()
      .min(0)
      .nullable()
      .default(fromAiDecimal(role.monthlyPoints)),
    ...grantFields,
    ...limitFields,
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const record = values as Record<string, unknown>;
    const result = await onSave({
      grants: permissions.map((permission, index) => {
        const choice = record[grantId(index)];
        const limit = record[limitId(index)];
        const granted =
          !isGrantChoice(choice) || choice === "default"
            ? null
            : choice === "allow";

        return {
          dailyLimit: granted && typeof limit === "number" ? limit : null,
          granted,
          permission: permission.key,
        };
      }),
      monthlyPoints:
        values.monthlyPoints === null
          ? null
          : toAiDecimal(values.monthlyPoints),
      roleId: role.id,
      unlimited: values.unlimited,
    });

    if ("error" in result) {
      toast.error(tError("title"), {
        description: tError("internal_server_error"),
      });

      return;
    }

    toast.success(t("saved.title"), {
      description: t("saved.desc", { name: resolveRoleName(role, locale) }),
    });
    setIsDirty?.(false);
    setOpen?.(false);
  };

  const grantLabels = (defaultGranted: boolean) => [
    {
      label: defaultGranted
        ? t("grant.default_allowed")
        : t("grant.default_denied"),
      value: "default",
    },
    { label: t("grant.allow"), value: "allow" },
    { label: t("grant.deny"), value: "deny" },
  ];

  return (
    <AutoForm
      fields={[
        {
          component: props => (
            <AutoFormSwitch
              {...props}
              description={t("unlimited_desc")}
              label={t("unlimited")}
            />
          ),
          id: "unlimited",
          tab: "allowance",
        },
        {
          component: props => (
            <AutoFormNullableNumber
              {...props}
              description={t("monthly_points_desc")}
              label={t("monthly_points")}
              min={0}
              orLabel={t("or")}
              step={1}
              toggleLabel={t("site_default")}
              unitLabel={t("points_unit")}
            />
          ),
          hidden: values => values.unlimited === true,
          id: "monthlyPoints",
          tab: "allowance",
        },
        ...permissions.flatMap((permission, index) => [
          {
            component: (props: ItemAutoFormComponentProps) => (
              <AutoFormSelect
                {...props}
                description={permission.key}
                label={describePermission(permission.key)}
                labels={grantLabels(permission.defaultGranted)}
              />
            ),
            id: grantId(index),
            tab: "features",
          },
          {
            component: (props: ItemAutoFormComponentProps) => (
              <AutoFormNullableNumber
                {...props}
                label={t("daily_limit")}
                min={0}
                orLabel={t("or")}
                step={1}
                toggleLabel={t("action_default")}
                unitLabel={t("per_day")}
              />
            ),
            hidden: (values: Record<string, unknown>) =>
              values[grantId(index)] !== "allow",
            id: limitId(index),
            tab: "features",
          },
        ]),
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButtonProps={{ children: t("submit") }}
      tabs={[
        { label: t("tabs.allowance"), value: "allowance" },
        { label: t("tabs.features"), value: "features" },
      ]}
    />
  );
};

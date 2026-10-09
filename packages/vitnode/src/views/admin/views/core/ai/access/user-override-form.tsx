import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormNullableNumber } from "@/components/form/fields/nullable-number";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { useDialog } from "@/components/ui/dialog";

import type { AdminAiUserOverrideInput } from "../ai-mutations";
import type { AdminAiUserOverride } from "../ai-query";

import { fromAiDecimal, toAiDecimal } from "../ai-decimal";

export interface AiUserOverrideFormProps {
  data: AdminAiUserOverride | null;
  onSave: (
    body: AdminAiUserOverrideInput,
  ) => Promise<AdminMutationResult<true>>;
  userId: number;
}

export const AiUserOverrideForm = ({
  data,
  onSave,
  userId,
}: AiUserOverrideFormProps) => {
  const t = useTranslations("admin.user.ai.form");
  const tError = useTranslations("core.global.errors");
  const { setIsDirty, setOpen } = useDialog();

  const formSchema = z.object({
    blocked: z.boolean().default(data?.blocked ?? false),
    unlimited: z.boolean().default(data?.unlimited ?? false),
    monthlyPoints: z
      .number()
      .min(0)
      .nullable()
      .default(fromAiDecimal(data?.monthlyPoints ?? null)),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const result = await onSave({
      blocked: values.blocked,
      monthlyPoints:
        values.monthlyPoints === null
          ? null
          : toAiDecimal(values.monthlyPoints),
      unlimited: values.unlimited,
      userId,
    });

    if ("error" in result) {
      toast.error(tError("title"), {
        description: tError("internal_server_error"),
      });

      return;
    }

    toast.success(t("saved.title"), { description: t("saved.desc") });
    setIsDirty?.(false);
    setOpen?.(false);
  };

  return (
    <AutoForm
      fields={[
        {
          component: props => (
            <AutoFormSwitch
              {...props}
              description={t("blocked_desc")}
              label={t("blocked")}
            />
          ),
          id: "blocked",
        },
        {
          component: props => (
            <AutoFormSwitch
              {...props}
              description={t("unlimited_desc")}
              label={t("unlimited")}
            />
          ),
          hidden: values => values.blocked === true,
          id: "unlimited",
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
              toggleLabel={t("from_roles")}
              unitLabel={t("points_unit")}
            />
          ),
          hidden: values =>
            values.blocked === true || values.unlimited === true,
          id: "monthlyPoints",
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButtonProps={{ children: t("submit") }}
    />
  );
};

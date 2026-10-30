import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormSheetFooter } from "@/components/form/auto-form-sheet-footer";
import { AutoFormNumber } from "@/components/form/fields/number";
import { AutoFormRadioGroup } from "@/components/form/fields/radio-group";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import {
  WARNING_LIMITS,
  WARNING_THRESHOLD_ACTIONS,
} from "@/lib/moderation/warnings";

import type {
  AdminWarningThreshold,
  AdminWarningThresholdInput,
} from "./warnings-admin-api";

export interface WarningThresholdFormProps {
  onSave: (args: {
    id?: number;
    values: AdminWarningThresholdInput;
  }) => Promise<AdminMutationResult<{ id: number }>>;
  onSaved: () => void;
  threshold?: AdminWarningThreshold;
}

export const WarningThresholdForm = ({
  onSave,
  onSaved,
  threshold,
}: WarningThresholdFormProps) => {
  const t = useTranslations("admin.moderation.warning_thresholds.form");

  const formSchema = z.object({
    points: z
      .number()
      .int()
      .min(1)
      .max(WARNING_LIMITS.maxThresholdPoints)
      .default(threshold?.points ?? 10),
    action: z
      .enum(WARNING_THRESHOLD_ACTIONS)
      .default(threshold?.action ?? "suspend_temporary"),
    durationHours: z
      .number()
      .int()
      .min(1)
      .max(WARNING_LIMITS.maxDurationHours)
      .default(threshold?.durationHours ?? 24),
    enabled: z.boolean().default(threshold?.enabled ?? true),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const result = await onSave({
      id: threshold?.id,
      values: {
        ...values,
        durationHours:
          values.action === "suspend_temporary" ? values.durationHours : null,
      },
    });

    if ("error" in result) {
      toast.error(t("error"), {
        description:
          result.error.status === 409
            ? result.error.message?.includes("limit_reached")
              ? t("limit_reached", { max: WARNING_LIMITS.maxThresholds })
              : t("duplicate_points")
            : t("error_desc"),
      });

      return;
    }

    toast.success(threshold ? t("updated") : t("created"), {
      description: t("saved_desc"),
    });
    onSaved();
  };

  return (
    <AutoForm
      className="flex min-h-0 flex-1 flex-col gap-0"
      fields={[
        {
          id: "points",
          component: props => (
            <AutoFormNumber
              {...props}
              description={t("points_desc")}
              label={t("points")}
              unitLabel={t("points_unit")}
            />
          ),
        },
        {
          id: "action",
          component: props => (
            <AutoFormRadioGroup
              {...props}
              label={t("action")}
              labels={WARNING_THRESHOLD_ACTIONS.map(action => ({
                description: t(`actions.${action}_desc`),
                label: t(`actions.${action}`),
                value: action,
              }))}
            />
          ),
        },
        {
          id: "durationHours",
          hidden: values => values.action !== "suspend_temporary",
          component: props => (
            <AutoFormNumber
              {...props}
              description={t("duration_desc")}
              label={t("duration")}
              unitLabel={t("hours_unit")}
            />
          ),
        },
        {
          id: "enabled",
          component: props => (
            <AutoFormSwitch
              {...props}
              description={t("enabled_desc")}
              label={t("enabled")}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      id={
        threshold
          ? `warning-threshold-${threshold.id}`
          : "warning-threshold-new"
      }
      layout={rendered => (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-5">
            <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
              {t("future_only")}
            </p>
            {rendered.points}
            {rendered.action}
            {rendered.durationHours}
            {rendered.enabled}
          </div>
          <AutoFormSheetFooter
            submitLabel={threshold ? t("submit_edit") : t("submit_create")}
          />
        </>
      )}
      onSubmit={onSubmit}
    />
  );
};

export default WarningThresholdForm;

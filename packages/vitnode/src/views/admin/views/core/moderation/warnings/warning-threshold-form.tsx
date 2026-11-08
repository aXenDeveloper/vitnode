import { useSelector } from "@tanstack/react-form";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormSheetFooter } from "@/components/form/auto-form-sheet-footer";
import { AutoFormNullableNumber } from "@/components/form/fields/nullable-number";
import { AutoFormNumber } from "@/components/form/fields/number";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { useFormApi } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WARNING_LIMITS } from "@/lib/moderation/warnings";
import {
  MINUTES_PER_UNIT,
  splitSuspensionMinutes,
  SUSPENSION_DURATION_UNITS,
} from "@/views/moderation/warnings/warning-format";

import type {
  AdminWarningThreshold,
  AdminWarningThresholdInput,
} from "./warnings-admin-api";

const DurationUnitSelect = ({
  accessibleLabel,
}: {
  accessibleLabel: string;
}) => {
  const t = useTranslations("admin.moderation.warning_thresholds.form.units");
  const { form } = useFormApi();
  const unit = useSelector(form.store, state => state.values.durationUnit);
  const isIndefinite = useSelector(
    form.store,
    state => state.values.durationValue === null,
  );
  const items = SUSPENSION_DURATION_UNITS.map(value => ({
    label: t(value),
    value,
  }));

  return (
    <Select
      disabled={isIndefinite}
      items={items}
      onValueChange={value => {
        form.setFieldValue("durationUnit", value);
      }}
      value={unit ?? null}
    >
      <SelectTrigger aria-label={accessibleLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map(item => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

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
  const savedDuration = threshold?.durationMinutes
    ? splitSuspensionMinutes(threshold.durationMinutes)
    : { count: 1, unit: "days" as const };
  const isSavedIndefinite = threshold?.action === "suspend_indefinite";

  const formSchema = z.object({
    points: z
      .number()
      .int()
      .min(1)
      .max(WARNING_LIMITS.maxThresholdPoints)
      .default(threshold?.points ?? 10),
    durationValue: z
      .number()
      .int()
      .min(1)
      .max(WARNING_LIMITS.maxDurationMinutes)
      .nullable()
      .default(isSavedIndefinite ? null : savedDuration.count),
    durationUnit: z.enum(SUSPENSION_DURATION_UNITS).default(savedDuration.unit),
    enabled: z.boolean().default(threshold?.enabled ?? true),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async ({
    durationUnit,
    durationValue,
    ...values
  }) => {
    const durationMinutes =
      durationValue === null
        ? null
        : durationValue * MINUTES_PER_UNIT[durationUnit];
    if (
      durationMinutes !== null &&
      durationMinutes > WARNING_LIMITS.maxDurationMinutes
    ) {
      toast.error(t("error"), { description: t("duration_too_long") });

      return;
    }

    const result = await onSave({
      id: threshold?.id,
      values: {
        ...values,
        action:
          durationMinutes === null ? "suspend_indefinite" : "suspend_temporary",
        durationMinutes,
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
          component: props => <AutoFormNumber {...props} label={t("points")} />,
        },
        {
          id: "durationValue",
          component: props => (
            <AutoFormNullableNumber
              {...props}
              label={t("suspend_for")}
              orLabel={t("or")}
              resumeValue={savedDuration.count}
              toggleLabel={t("indefinitely")}
              unitLabel={
                <DurationUnitSelect accessibleLabel={t("duration_unit")} />
              }
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
            {rendered.points}
            {rendered.durationValue}
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

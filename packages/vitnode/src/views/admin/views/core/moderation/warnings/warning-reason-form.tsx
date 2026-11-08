import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormSheetFooter } from "@/components/form/auto-form-sheet-footer";
import { AutoFormInput } from "@/components/form/fields/input";
import { AutoFormNullableNumber } from "@/components/form/fields/nullable-number";
import { AutoFormNumber } from "@/components/form/fields/number";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { AutoFormTextarea } from "@/components/form/fields/textarea";
import { multiLangValueSchema } from "@/lib/helpers/multi-lang";
import { WARNING_LIMITS } from "@/lib/moderation/warnings";
import { resolveReasonText } from "@/views/moderation/report-reasons-query";
import { splitSuspensionMinutes } from "@/views/moderation/warnings/warning-format";

import type {
  AdminWarningReason,
  AdminWarningReasonInput,
  AdminWarningThreshold,
} from "./warnings-admin-api";

const PointsEffect = ({
  points,
  thresholds,
}: {
  points: number;
  thresholds: AdminWarningThreshold[];
}) => {
  const t = useTranslations("admin.moderation.warning_reasons.form");
  const tDuration = useTranslations("core.moderation.warn.duration");
  const steps = thresholds
    .filter(threshold => threshold.enabled)
    .toSorted((a, b) => a.points - b.points);
  const actionOf = (threshold: AdminWarningThreshold) => {
    if (
      threshold.action !== "suspend_temporary" ||
      !threshold.durationMinutes
    ) {
      return t("action_suspend_indefinitely");
    }
    const { count, unit } = splitSuspensionMinutes(threshold.durationMinutes);

    return t("action_suspend_for", { duration: tDuration(unit, { count }) });
  };

  if (points <= 0) return t("points_effect.none");
  const reached = steps.filter(step => step.points <= points).at(-1);
  if (reached) {
    return t("points_effect.alone", { action: actionOf(reached) });
  }
  const first = steps.at(0);
  if (!first) return t("points_effect.no_thresholds");

  return t("points_effect.repeat", {
    action: actionOf(first),
    count: Math.ceil(first.points / points),
    points: first.points,
  });
};

export interface WarningReasonFormProps {
  onSave: (args: {
    id?: number;
    values: AdminWarningReasonInput;
  }) => Promise<AdminMutationResult<{ id: number }>>;
  onSaved: () => void;
  reason?: AdminWarningReason;
  thresholds: AdminWarningThreshold[];
}

export const WarningReasonForm = ({
  onSave,
  onSaved,
  reason,
  thresholds,
}: WarningReasonFormProps) => {
  const t = useTranslations("admin.moderation.warning_reasons.form");
  const locale = useLocale();

  const formSchema = z.object({
    title: multiLangValueSchema({
      maxLength: WARNING_LIMITS.reasonTitleMaxLength,
      minLength: 1,
    })
      .min(1)
      .default(reason?.title ?? []),
    description: multiLangValueSchema({
      maxLength: WARNING_LIMITS.reasonDescriptionMaxLength,
    }).default(reason?.description ?? []),
    points: z
      .number()
      .int()
      .min(0)
      .max(WARNING_LIMITS.maxPoints)
      .default(reason?.points ?? 1),
    expiresAfterDays: z
      .number()
      .int()
      .min(1)
      .max(WARNING_LIMITS.maxDurationHours / 24)
      .nullable()
      .default(
        reason
          ? reason.expiresAfterHours === null
            ? null
            : Math.max(1, Math.round(reason.expiresAfterHours / 24))
          : 30,
      ),
    message: multiLangValueSchema({
      maxLength: WARNING_LIMITS.reasonMessageMaxLength,
    }).default(reason?.message ?? []),
    enabled: z.boolean().default(reason?.enabled ?? true),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async ({
    expiresAfterDays,
    ...values
  }) => {
    const result = await onSave({
      id: reason?.id,
      values: {
        ...values,
        expiresAfterHours:
          expiresAfterDays === null ? null : expiresAfterDays * 24,
      },
    });

    if ("error" in result) {
      toast.error(t("error"), {
        description:
          result.error.status === 409
            ? t("limit_reached", { max: WARNING_LIMITS.maxReasons })
            : t("error_desc"),
      });

      return;
    }

    toast.success(reason ? t("updated") : t("created"), {
      description: reason
        ? t("updated_desc")
        : t("created_desc", {
            reason: resolveReasonText(values.title, locale),
          }),
    });
    onSaved();
  };

  return (
    <AutoForm
      className="flex min-h-0 flex-1 flex-col gap-0"
      fields={[
        {
          id: "title",
          component: props => (
            <AutoFormInput {...props} label={t("title")} multiLang />
          ),
        },
        {
          id: "description",
          component: props => (
            <AutoFormTextarea
              {...props}
              description={t("description_desc")}
              label={t("description")}
              multiLang
            />
          ),
        },
        {
          id: "points",
          component: props => (
            <AutoFormNumber
              {...props}
              description={
                <PointsEffect
                  points={Number(props.field.value) || 0}
                  thresholds={thresholds}
                />
              }
              label={t("points")}
            />
          ),
        },
        {
          id: "expiresAfterDays",
          component: props => (
            <AutoFormNullableNumber
              {...props}
              description={t("expires_desc")}
              label={t("expires")}
              orLabel={t("or")}
              resumeValue={30}
              toggleLabel={t("never_expires")}
              unitLabel={t("days_unit")}
            />
          ),
        },
        {
          id: "message",
          component: props => (
            <AutoFormTextarea
              {...props}
              description={t("message_desc")}
              label={t("message")}
              multiLang
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
      id={reason ? `warning-reason-${reason.id}` : "warning-reason-new"}
      layout={rendered => (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-5">
            {rendered.title}
            {rendered.description}
            {rendered.points}
            {rendered.expiresAfterDays}
            {rendered.message}
            {rendered.enabled}
          </div>
          <AutoFormSheetFooter
            submitLabel={reason ? t("submit_edit") : t("submit_create")}
          />
        </>
      )}
      onSubmit={onSubmit}
    />
  );
};

export default WarningReasonForm;

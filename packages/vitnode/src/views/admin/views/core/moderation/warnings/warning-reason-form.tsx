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

import type {
  AdminWarningReason,
  AdminWarningReasonInput,
} from "./warnings-admin-api";

export interface WarningReasonFormProps {
  onSave: (args: {
    id?: number;
    values: AdminWarningReasonInput;
  }) => Promise<AdminMutationResult<{ id: number }>>;
  onSaved: () => void;
  reason?: AdminWarningReason;
}

export const WarningReasonForm = ({
  onSave,
  onSaved,
  reason,
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
            <AutoFormInput
              {...props}
              description={t("title_desc")}
              label={t("title")}
              multiLang
            />
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
              description={t("points_desc")}
              label={t("points")}
              unitLabel={t("points_unit")}
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

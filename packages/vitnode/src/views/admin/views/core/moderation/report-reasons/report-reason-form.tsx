import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormSheetFooter } from "@/components/form/auto-form-sheet-footer";
import { AutoFormInput } from "@/components/form/fields/input";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { AutoFormTextarea } from "@/components/form/fields/textarea";
import { multiLangValueSchema } from "@/lib/helpers/multi-lang";
import { MODERATION_LIMITS } from "@/lib/moderation/const";
import { resolveReasonText } from "@/views/moderation/report-reasons-query";

import type { AdminReportReasonInput } from "./report-reasons-mutations";
import type { AdminReportReason } from "./report-reasons-query";

export interface ReportReasonFormProps {
  onSave: (args: {
    id?: number;
    values: AdminReportReasonInput;
  }) => Promise<AdminMutationResult<{ id: number }>>;
  onSaved: () => void;
  reason?: AdminReportReason;
}

export const ReportReasonForm = ({
  onSave,
  onSaved,
  reason,
}: ReportReasonFormProps) => {
  const t = useTranslations("admin.moderation.report_reasons.form");
  const locale = useLocale();

  const formSchema = z.object({
    title: multiLangValueSchema({
      maxLength: MODERATION_LIMITS.reasonTitleMaxLength,
      minLength: 1,
    })
      .min(1)
      .default(reason?.title ?? []),
    description: multiLangValueSchema({
      maxLength: MODERATION_LIMITS.reasonDescriptionMaxLength,
    }).default(reason?.description ?? []),
    requiresDetails: z.boolean().default(reason?.requiresDetails ?? false),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const result = await onSave({ id: reason?.id, values });

    if ("error" in result) {
      toast.error(t("error"), {
        description:
          result.error.status === 409
            ? t("limit_reached", { max: MODERATION_LIMITS.maxReportReasons })
            : t("error_desc"),
      });

      return;
    }

    if (reason) {
      toast.success(t("updated"), { description: t("updated_desc") });
    } else {
      toast.success(t("created"), {
        description: t("created_desc", {
          reason: resolveReasonText(values.title, locale),
        }),
      });
    }
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
          id: "requiresDetails",
          component: props => (
            <AutoFormSwitch
              {...props}
              description={t("requires_details_desc", {
                min: MODERATION_LIMITS.requiredDescriptionMinLength,
              })}
              label={t("requires_details")}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      id={reason ? `report-reason-${reason.id}` : "report-reason-new"}
      layout={rendered => (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-5">
            {rendered.title}
            {rendered.description}
            {rendered.requiresDetails}
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

export default ReportReasonForm;

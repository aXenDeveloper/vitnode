import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

import { AutoForm, AutoFormSubmitButton } from "@/components/form/auto-form";
import { AutoFormRadioGroup } from "@/components/form/fields/radio-group";
import { AutoFormTextarea } from "@/components/form/fields/textarea";
import { Button } from "@/components/ui/button";
import {
  MODERATION_LIMITS,
  MODERATION_REPORT_REASONS,
} from "@/lib/moderation/const";

import { createReport } from "../moderation-mutations";

export interface ReportDialogContentProps {
  locale: null | string;
  onClose: () => void;
  pluginId: string;
  requestedLocale: null | string;
  targetId: string;
  targetType: string;
}

export const ReportDialogContent = ({
  locale,
  onClose,
  pluginId,
  requestedLocale,
  targetId,
  targetType,
}: ReportDialogContentProps) => {
  const t = useTranslations("core.moderation");

  const formSchema = z
    .object({
      reason: z.enum(MODERATION_REPORT_REASONS),
      description: z
        .string()
        .trim()
        .max(MODERATION_LIMITS.descriptionMaxLength)
        .optional(),
    })
    .superRefine((values, ctx) => {
      if (
        values.reason === "other" &&
        (values.description?.length ?? 0) <
          MODERATION_LIMITS.otherDescriptionMinLength
      ) {
        ctx.addIssue({
          code: "too_small",
          minimum: MODERATION_LIMITS.otherDescriptionMinLength,
          origin: "string",
          path: ["description"],
          message: t("report.errors.validation"),
        });
      }
    });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const result = await createReport({
      description:
        values.description?.trim() === ""
          ? null
          : (values.description?.trim() ?? null),
      locale,
      pluginId,
      reason: values.reason,
      requestedLocale,
      targetId,
      targetType,
    });

    if (!result.ok) {
      const key =
        result.failure === "duplicate" ||
        result.failure === "not_found" ||
        result.failure === "rate_limited" ||
        result.failure === "unauthenticated" ||
        result.failure === "validation"
          ? result.failure
          : "unknown";
      toast.error(t("report.errors.title"), {
        description: t(`report.errors.${key}`),
      });
      if (key === "duplicate" || key === "not_found") onClose();

      return;
    }

    toast.success(t("report.success"), {
      description: t("report.success_desc"),
    });
    onClose();
  };

  return (
    <AutoForm
      className="flex flex-col gap-4"
      fields={[
        {
          component: props => (
            <AutoFormRadioGroup
              {...props}
              label={t("report.reason")}
              labels={MODERATION_REPORT_REASONS.map(reason => ({
                description: t(`reason_descs.${reason}`),
                label: t(`reasons.${reason}`),
                value: reason,
              }))}
            />
          ),
          id: "reason",
        },
        {
          component: props => (
            <AutoFormTextarea
              {...props}
              description={t("report.description_desc")}
              label={t("report.description")}
              maxLength={MODERATION_LIMITS.descriptionMaxLength}
            />
          ),
          id: "description",
        },
      ]}
      formSchema={formSchema}
      layout={rendered => (
        <>
          {rendered.reason}
          {rendered.description}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button onClick={onClose} type="button" variant="ghost">
              {t("report.cancel")}
            </Button>
            <AutoFormSubmitButton>{t("report.submit")}</AutoFormSubmitButton>
          </div>
        </>
      )}
      onSubmit={onSubmit}
    />
  );
};

export default ReportDialogContent;

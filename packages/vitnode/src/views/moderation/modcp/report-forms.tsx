import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type { ModerationReportResolution } from "@/lib/moderation/const";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormRadioGroup } from "@/components/form/fields/radio-group";
import { AutoFormTextarea } from "@/components/form/fields/textarea";
import {
  MODERATION_LIMITS,
  MODERATION_REPORT_RESOLUTIONS,
} from "@/lib/moderation/const";

import type { ModerationResult, ReportState } from "../moderation-mutations";

import { reopenReport, resolveReport } from "../moderation-mutations";

const noteField = z
  .string()
  .trim()
  .min(MODERATION_LIMITS.explanationMinLength)
  .max(MODERATION_LIMITS.noteMaxLength);

export const useReportFailure = () => {
  const t = useTranslations("core.moderation.modcp.detail.errors");

  return (result: ModerationResult<unknown>): boolean => {
    if (result.ok) return false;
    const known = [
      "already_claimed",
      "assignee_not_eligible",
      "conflict",
      "forbidden",
      "note_not_found",
      "report_closed",
      "report_open",
      "target_gone",
    ] as const;
    const key = (known as readonly string[]).includes(result.failure)
      ? (result.failure as (typeof known)[number])
      : "unknown";
    toast.error(t(key));

    return true;
  };
};

export const ResolveReportForm = ({
  defaultResolution,
  expectedVersion,
  id,
  onDone,
}: {
  defaultResolution?: ModerationReportResolution;
  expectedVersion: number;
  id: number;
  onDone: () => Promise<void>;
}) => {
  const t = useTranslations("core.moderation");
  const fail = useReportFailure();
  const resolution = z.enum(MODERATION_REPORT_RESOLUTIONS);
  const formSchema = z.object({
    resolution: defaultResolution
      ? resolution.default(defaultResolution)
      : resolution,
    explanation: z
      .string()
      .trim()
      .max(MODERATION_LIMITS.noteMaxLength)
      .optional(),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const result = await resolveReport({
      expectedVersion,
      explanation: values.explanation === "" ? undefined : values.explanation,
      id,
      resolution: values.resolution,
    });
    if (fail(result)) {
      await onDone();

      return;
    }
    toast.success(t("modcp.detail.resolve.success"), {
      description: t("modcp.detail.resolve.success_desc"),
    });
    await onDone();
  };

  return (
    <AutoForm
      className="flex flex-col gap-4"
      fields={[
        {
          component: props => (
            <AutoFormRadioGroup
              {...props}
              label={t("modcp.detail.resolve.resolution")}
              labels={MODERATION_REPORT_RESOLUTIONS.map(value => ({
                description: t(`resolution_descs.${value}`),
                label: t(`resolutions.${value}`),
                value,
              }))}
            />
          ),
          id: "resolution",
        },
        {
          component: props => (
            <AutoFormTextarea
              {...props}
              description={t("modcp.detail.resolve.explanation_desc")}
              label={t("modcp.detail.resolve.explanation")}
              maxLength={MODERATION_LIMITS.noteMaxLength}
            />
          ),
          id: "explanation",
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButtonProps={{ children: t("modcp.detail.resolve.submit") }}
    />
  );
};

export const ReopenReportForm = ({
  expectedVersion,
  id,
  onDone,
  onReopened,
}: {
  expectedVersion: number;
  id: number;
  onDone: () => Promise<void>;
  onReopened?: (state: ReportState) => Promise<void>;
}) => {
  const t = useTranslations("core.moderation.modcp.detail.reopen");
  const fail = useReportFailure();
  const formSchema = z.object({ reason: noteField });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const result = await reopenReport({
      expectedVersion,
      id,
      reason: values.reason,
    });
    if (!fail(result)) {
      toast.success(t("success"));
      if (result.ok) await onReopened?.(result.data);
    }
    await onDone();
  };

  return (
    <AutoForm
      className="flex flex-col gap-4"
      fields={[
        {
          component: props => (
            <AutoFormTextarea
              {...props}
              label={t("reason")}
              maxLength={MODERATION_LIMITS.noteMaxLength}
            />
          ),
          id: "reason",
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButtonProps={{ children: t("submit") }}
    />
  );
};

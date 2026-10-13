import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormTextarea } from "@/components/form/fields/textarea";

import type { ApprovalResult } from "../../approval-mutations";

import { rejectSubmission } from "../../approval-mutations";

const REASON_MAX_LENGTH = 2000;

const ApprovalRejectForm = ({
  id,
  onSettled,
}: {
  id: number;
  onSettled: (result: ApprovalResult) => Promise<void>;
}) => {
  const t = useTranslations("core.moderation.modcp.approvals.reject");
  const formSchema = z.object({
    reason: z.string().trim().max(REASON_MAX_LENGTH).optional(),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const reason = values.reason?.trim() ?? "";
    await onSettled(
      await rejectSubmission({ id, reason: reason === "" ? null : reason }),
    );
  };

  return (
    <AutoForm
      className="flex flex-col gap-4"
      fields={[
        {
          component: props => (
            <AutoFormTextarea
              {...props}
              description={t("reason_desc")}
              label={t("reason")}
              maxLength={REASON_MAX_LENGTH}
            />
          ),
          id: "reason",
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButtonProps={{ children: t("submit"), variant: "destructive" }}
    />
  );
};

export default ApprovalRejectForm;

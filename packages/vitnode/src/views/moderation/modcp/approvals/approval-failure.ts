import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { ApprovalResult } from "../../approval-mutations";

/** Shows the toast for a failed decision; `true` when there was one. */
export const useApprovalFailure = () => {
  const t = useTranslations("core.moderation.modcp.approvals.errors");

  return (result: ApprovalResult): boolean => {
    if (result.ok) return false;
    toast.error(t(`${result.failure}.title`), {
      description: t(`${result.failure}.desc`),
    });

    return true;
  };
};

import { useQueryClient } from "@tanstack/react-query";
import React from "react";

import type { ReportReasonsContentProps } from "@/views/admin/views/core/moderation/report-reasons/report-reasons-content";
import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import {
  createAdminReportReason,
  deleteAdminReportReason,
  reorderAdminReportReasons,
  updateAdminReportReason,
} from "@/views/admin/views/core/moderation/report-reasons/report-reasons-mutations";
import {
  adminReportReasonsQueryOptions,
  adminReportReasonsQueryRoot,
} from "@/views/admin/views/core/moderation/report-reasons/report-reasons-query";
import { isAdminMutationError } from "@/views/admin/views/core/shared/admin-mutation";
import { REPORT_REASONS_QUERY_KEY } from "@/views/moderation/report-reasons-query";

import { useAdminIdentity } from "../identity";

export const adminReportReasonsQuery = (adminUserId: AdminIdentity) =>
  adminReportReasonsQueryOptions(adminUserId);

export const useAdminReportReasonMutations = (): Pick<
  ReportReasonsContentProps,
  "onDelete" | "onReorder" | "onSave"
> => {
  const queryClient = useQueryClient();
  const adminUserId = useAdminIdentity();

  return React.useMemo(() => {
    const refresh = async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: adminReportReasonsQueryRoot(adminUserId),
        }),
        queryClient.invalidateQueries({ queryKey: REPORT_REASONS_QUERY_KEY }),
      ]);
    };

    return {
      onDelete: async id => {
        const result = await deleteAdminReportReason(id);
        if (!isAdminMutationError(result)) await refresh();

        return result;
      },
      onReorder: async ids => {
        const result = await reorderAdminReportReasons(ids);
        if (isAdminMutationError(result)) {
          throw new Error(`Saving the order answered ${result.error.status}.`);
        }
        await refresh();
      },
      onSave: async ({ id, values }) => {
        const result =
          id === undefined
            ? await createAdminReportReason(values)
            : await updateAdminReportReason(id, values);
        if (!isAdminMutationError(result)) await refresh();

        return result;
      },
    };
  }, [adminUserId, queryClient]);
};

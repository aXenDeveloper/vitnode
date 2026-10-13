import { FilePlusIcon, PencilIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import type { ModcpApprovalItem, ModcpApprovalStatus } from "../modcp-query";
import type { ToneName } from "../report-tone";

import { Chip } from "../report-tone";

export const APPROVAL_STATUS_TONE: Record<ModcpApprovalStatus, ToneName> = {
  approved: "success",
  cancelled: "muted",
  pending: "warning",
  rejected: "destructive",
  superseded: "muted",
};

export const ApprovalKindChip = ({
  kind,
}: {
  kind: ModcpApprovalItem["kind"];
}) => {
  const t = useTranslations("core.moderation.modcp.approvals.kinds");

  return (
    <Chip
      icon={kind === "create" ? FilePlusIcon : PencilIcon}
      tone={kind === "create" ? "info" : "muted"}
    >
      {t(kind)}
    </Chip>
  );
};

export const ApprovalStatusChip = ({
  status,
}: {
  status: ModcpApprovalStatus;
}) => {
  const t = useTranslations("core.moderation.modcp.approvals.statuses");

  return <Chip tone={APPROVAL_STATUS_TONE[status]}>{t(status)}</Chip>;
};

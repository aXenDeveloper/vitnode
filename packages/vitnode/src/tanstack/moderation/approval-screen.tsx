import { ModcpApprovalContent } from "@/views/moderation/modcp/approvals/approval-content";

import { RouteMessages } from "../i18n/route-messages";
import { MODCP_NAMESPACES } from "./namespaces";

export const ModcpApprovalRouteContent = ({ id }: { id: number }) => (
  <RouteMessages namespaces={MODCP_NAMESPACES}>
    <ModcpApprovalContent id={id} />
  </RouteMessages>
);

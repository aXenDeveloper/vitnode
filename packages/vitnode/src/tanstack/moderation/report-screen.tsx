import { ModcpReportContent } from "@/views/moderation/modcp/report-content";

import { RouteMessages } from "../i18n/route-messages";
import { MODCP_NAMESPACES } from "./namespaces";

export const ModcpReportRouteContent = ({
  id,
  userId,
}: {
  id: number;
  userId: number;
}) => (
  <RouteMessages namespaces={MODCP_NAMESPACES}>
    <ModcpReportContent id={id} userId={userId} />
  </RouteMessages>
);

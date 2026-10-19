import { buildModule } from "@/api/builders";

import {
  createReportReasonAdminRoute,
  deleteReportReasonAdminRoute,
  listReportReasonsAdminRoute,
  reorderReportReasonsAdminRoute,
  updateReportReasonAdminRoute,
} from "./routes/report-reasons.routes";

export const reportReasonsAdminModule = buildModule({
  name: "report-reasons",
  routes: [
    listReportReasonsAdminRoute,
    createReportReasonAdminRoute,
    reorderReportReasonsAdminRoute,
    updateReportReasonAdminRoute,
    deleteReportReasonAdminRoute,
  ],
});

import { buildModule } from "@/api/builders";

import { createReportReasonAdminRoute } from "./routes/create.route";
import { deleteReportReasonAdminRoute } from "./routes/delete.route";
import { listReportReasonsAdminRoute } from "./routes/list.route";
import { reorderReportReasonsAdminRoute } from "./routes/reorder.route";
import { updateReportReasonAdminRoute } from "./routes/update.route";

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

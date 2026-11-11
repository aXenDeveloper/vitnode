import { buildModule } from "@/api/builders";

import { createWarningReasonAdminRoute } from "./routes/create-reason.route";
import { createWarningThresholdAdminRoute } from "./routes/create-threshold.route";
import { deleteWarningThresholdAdminRoute } from "./routes/delete-threshold.route";
import { listWarningReasonsAdminRoute } from "./routes/list-reasons.route";
import { listWarningThresholdsAdminRoute } from "./routes/list-thresholds.route";
import { reorderWarningReasonsAdminRoute } from "./routes/reorder-reasons.route";
import { updateWarningReasonAdminRoute } from "./routes/update-reason.route";
import { updateWarningThresholdAdminRoute } from "./routes/update-threshold.route";

export const warningsAdminModule = buildModule({
  name: "warnings",
  routes: [
    listWarningReasonsAdminRoute,
    createWarningReasonAdminRoute,
    reorderWarningReasonsAdminRoute,
    updateWarningReasonAdminRoute,
    listWarningThresholdsAdminRoute,
    createWarningThresholdAdminRoute,
    updateWarningThresholdAdminRoute,
    deleteWarningThresholdAdminRoute,
  ],
});

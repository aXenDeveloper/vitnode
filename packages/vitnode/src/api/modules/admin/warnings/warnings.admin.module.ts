import { buildModule } from "@/api/builders";

import {
  createWarningReasonAdminRoute,
  listWarningReasonsAdminRoute,
  reorderWarningReasonsAdminRoute,
  updateWarningReasonAdminRoute,
} from "./routes/warning-reasons.routes";
import {
  createWarningThresholdAdminRoute,
  deleteWarningThresholdAdminRoute,
  listWarningThresholdsAdminRoute,
  updateWarningThresholdAdminRoute,
} from "./routes/warning-thresholds.routes";

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

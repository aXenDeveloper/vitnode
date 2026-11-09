import { buildModule } from "@/api/builders";

import { activityLogActorsAdminRoute } from "./routes/actors.route";
import { activityLogDetailAdminRoute } from "./routes/detail.route";
import { activityLogEntityAdminRoute } from "./routes/entity.route";
import { exportActivityLogsAdminRoute } from "./routes/export.route";
import { activityLogFiltersAdminRoute } from "./routes/filters.route";
import { listActivityLogsAdminRoute } from "./routes/list.route";

export const activityLogsAdminModule = buildModule({
  name: "activity-logs",
  // The fixed paths first, so `/{id}` never shadows them.
  routes: [
    listActivityLogsAdminRoute,
    activityLogFiltersAdminRoute,
    activityLogActorsAdminRoute,
    activityLogEntityAdminRoute,
    exportActivityLogsAdminRoute,
    activityLogDetailAdminRoute,
  ],
});

import { buildModule } from "@/builders";

import { cleanQueueTasksRoute } from "./routes/clean.route";
import { getQueueTasksRoute } from "./routes/list.route";

export const queueAdminModule = buildModule({
  name: "queue",
  routes: [getQueueTasksRoute, cleanQueueTasksRoute],
});

import { buildModule } from "@/api/builders";

import { getQueueTasksRoute } from "./routes/list.route";

export const queueAdminModule = buildModule({
  name: "queue",
  routes: [getQueueTasksRoute],
});

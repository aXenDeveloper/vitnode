import { buildModule } from "@/api/builders";

import { getQueueTasksRoute } from "./routes/get.route";

export const queueAdminModule = buildModule({
  name: "queue",
  routes: [getQueueTasksRoute],
});

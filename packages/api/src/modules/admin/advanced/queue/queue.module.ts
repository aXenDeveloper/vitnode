import { buildModule } from "@/builders";

import { getQueueTasksRoute } from "./routes/list.route";

export const queueAdminModule = buildModule({
  name: "queue",
  routes: [getQueueTasksRoute],
});

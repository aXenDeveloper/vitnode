import { buildModule } from "@/builders";
import { reactionsLiveWebSocket } from "@/lib/reactions/live/socket";

import { reactionsCleanupCron } from "./cron/cleanup.cron";
import { reactionsCatalogRoute } from "./routes/catalog.route";
import { reactRoute } from "./routes/react.route";
import { reputationRoute } from "./routes/reputation.route";
import { reactionsSummariesRoute } from "./routes/summaries.route";
import { unreactRoute } from "./routes/unreact.route";
import { reactionUsersRoute } from "./routes/users.route";
import { recountReputationQueueTask } from "./tasks/recount-reputation.task";

export const reactionsModule = buildModule({
  name: "reactions",
  routes: [
    reactionsCatalogRoute,
    reactionsSummariesRoute,
    reactRoute,
    unreactRoute,
    reactionUsersRoute,
    reputationRoute,
  ],
  cronJobs: [reactionsCleanupCron],
  queueTasks: [recountReputationQueueTask],
  webSockets: [reactionsLiveWebSocket],
});

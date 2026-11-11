import { buildModule } from "@/api/builders";
import { announceCorrectionTask } from "@/api/tasks/announce-correction.task";

import { listCorrectionsRoute } from "./routes/list.route";

export const correctionsModule = buildModule({
  name: "corrections",
  routes: [listCorrectionsRoute],
  queueTasks: [announceCorrectionTask],
});

import { buildModule } from "@/builders";
import {
  legalDeliveryCron,
  legalEffectiveTask,
  legalFanoutTask,
  legalSendTask,
} from "@/lib/legal/delivery-tasks";

import { acceptLegalRoute } from "./routes/accept.route";
import { acceptancesLegalRoute } from "./routes/acceptances.route";
import { compareLegalRoute } from "./routes/compare.route";
import { dismissLegalRoute } from "./routes/dismiss.route";
import { documentLegalRoute } from "./routes/document.route";
import { downloadLegalRoute } from "./routes/download.route";
import { linksLegalRoute } from "./routes/links.route";
import { meLegalRoute } from "./routes/me.route";
import { versionLegalRoute } from "./routes/version.route";

export const legalModule = buildModule({
  name: "legal",
  routes: [
    linksLegalRoute,
    meLegalRoute,
    acceptancesLegalRoute,
    acceptLegalRoute,
    dismissLegalRoute,
    documentLegalRoute,
    versionLegalRoute,
    compareLegalRoute,
    downloadLegalRoute,
  ],
  cronJobs: [legalDeliveryCron],
  queueTasks: [legalFanoutTask, legalSendTask, legalEffectiveTask],
});

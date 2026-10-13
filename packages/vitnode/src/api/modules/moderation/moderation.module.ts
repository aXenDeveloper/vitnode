import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { createReportRoute } from "./routes/create.route";
import { listReportsRoute } from "./routes/list.route";
import {
  deleteReportNoteRoute,
  editReportNoteRoute,
} from "./routes/notes.routes";
import { showReportRoute } from "./routes/show.route";
import {
  assignReportRoute,
  claimReportRoute,
  noteReportRoute,
  reopenReportRoute,
  reportActionRoute,
  reportAssigneesRoute,
  resolveReportRoute,
} from "./routes/workflow.routes";

export const moderationModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "moderation",
  routes: [
    createReportRoute,
    listReportsRoute,
    showReportRoute,
    claimReportRoute,
    assignReportRoute,
    noteReportRoute,
    editReportNoteRoute,
    deleteReportNoteRoute,
    resolveReportRoute,
    reopenReportRoute,
    reportActionRoute,
    reportAssigneesRoute,
  ],
});

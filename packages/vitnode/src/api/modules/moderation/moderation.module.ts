import { buildModule } from "@/api/builders";

import { accountStatusRoute } from "./routes/account-status.route";
import {
  approvalFiltersRoute,
  approveApprovalRoute,
  listApprovalsRoute,
  myApprovalsRoute,
  rejectApprovalRoute,
  showApprovalRoute,
} from "./routes/approvals.routes";
import { createReportRoute } from "./routes/create.route";
import { listReportsRoute } from "./routes/list.route";
import {
  deleteReportNoteRoute,
  editReportNoteRoute,
} from "./routes/notes.routes";
import { listReportReasonsRoute } from "./routes/reasons.route";
import { showReportRoute } from "./routes/show.route";
import {
  issueWarningRoute,
  listWarningReasonsRoute,
  listWarningsRoute,
  memberLogRoute,
  memberStandingRoute,
  previewWarningRoute,
  revokeSanctionRoute,
  revokeWarningRoute,
  searchMembersRoute,
} from "./routes/warnings.routes";
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
  name: "moderation",
  routes: [
    listReportReasonsRoute,
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
    listApprovalsRoute,
    approvalFiltersRoute,
    myApprovalsRoute,
    showApprovalRoute,
    approveApprovalRoute,
    rejectApprovalRoute,
    listWarningReasonsRoute,
    previewWarningRoute,
    issueWarningRoute,
    listWarningsRoute,
    revokeWarningRoute,
    revokeSanctionRoute,
    searchMembersRoute,
    memberStandingRoute,
    memberLogRoute,
    accountStatusRoute,
  ],
});

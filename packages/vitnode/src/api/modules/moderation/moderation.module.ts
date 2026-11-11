import { buildModule } from "@/api/builders";

import { approveApprovalRoute } from "./routes/approve-approval.route";
import { assignReportRoute } from "./routes/assign-report.route";
import { claimReportRoute } from "./routes/claim-report.route";
import { noteReportRoute } from "./routes/create-report-note.route";
import { createReportRoute } from "./routes/create-report.route";
import { deleteReportNoteRoute } from "./routes/delete-report-note.route";
import { issueWarningRoute } from "./routes/issue-warning.route";
import { accountStatusHistoryRoute } from "./routes/list-account-status-history.route";
import { listApprovalsRoute } from "./routes/list-approvals.route";
import { memberLogRoute } from "./routes/list-member-log.route";
import { myApprovalsRoute } from "./routes/list-my-approvals.route";
import { reportAssigneesRoute } from "./routes/list-report-assignees.route";
import { listReportReasonsRoute } from "./routes/list-report-reasons.route";
import { listReportsRoute } from "./routes/list-reports.route";
import { listWarningReasonsRoute } from "./routes/list-warning-reasons.route";
import { listWarningsRoute } from "./routes/list-warnings.route";
import { previewWarningRoute } from "./routes/preview-warning.route";
import { rejectApprovalRoute } from "./routes/reject-approval.route";
import { reopenReportRoute } from "./routes/reopen-report.route";
import { resolveReportRoute } from "./routes/resolve-report.route";
import { revokeSanctionRoute } from "./routes/revoke-sanction.route";
import { revokeWarningRoute } from "./routes/revoke-warning.route";
import { reportActionRoute } from "./routes/run-report-action.route";
import { searchMembersRoute } from "./routes/search-members.route";
import { accountStatusRoute } from "./routes/show-account-status.route";
import { approvalFiltersRoute } from "./routes/show-approval-filters.route";
import { showApprovalRoute } from "./routes/show-approval.route";
import { memberStandingRoute } from "./routes/show-member-standing.route";
import { showReportRoute } from "./routes/show-report.route";
import { editReportNoteRoute } from "./routes/update-report-note.route";

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
    accountStatusHistoryRoute,
  ],
});

export const stateOf = (report: {
  assigneeId: null | number;
  status: "done" | "in_progress" | "new";
  version: number;
}) => ({
  assigneeId: report.assigneeId,
  status: report.status,
  version: report.version,
});

import { parse } from "semver";

import type { AdminUpdateSummary } from "@/views/admin/views/core/system/plugins/update-summary-query";

export type UpdateStatus =
  | "disabled"
  | "no_info"
  | "not_checked"
  | "running"
  | "security"
  | "unavailable"
  | "unconfirmed"
  | "up_to_date"
  | "updates";

export const updateStatusOf = (summary: AdminUpdateSummary): UpdateStatus => {
  if (!summary.enabled) return "disabled";
  if (summary.running) return "running";
  if (summary.checkedComponents === 0) {
    return summary.notCheckedComponents > 0 ? "not_checked" : "unavailable";
  }
  if (summary.affectedComponents > 0) return "security";
  if (summary.updatesAvailable > 0) return "updates";
  if (summary.unconfirmedComponents >= summary.totalComponents) {
    return "no_info";
  }
  if (summary.unconfirmedComponents > 0) return "unconfirmed";

  return "up_to_date";
};

export const isKnownUpdateStatus = (status: UpdateStatus): boolean =>
  status === "security" ||
  status === "updates" ||
  status === "no_info" ||
  status === "unconfirmed" ||
  status === "up_to_date";

export const compactVersion = (current: null | string, latest: string) => {
  const next = parse(latest);
  const installed = current === null ? null : parse(current);

  return next !== null &&
    installed !== null &&
    next.prerelease.length > 0 &&
    installed.prerelease.length > 0 &&
    next.major === installed.major &&
    next.minor === installed.minor &&
    next.patch === installed.patch
    ? next.prerelease.join(".")
    : latest;
};

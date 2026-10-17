import type { AdminUpdateSummary } from "@/views/admin/views/core/system/plugins/update-summary-query";

/** A summary of an install whose every component was checked and is up to date. */
export const updateSummary = (
  overrides: Partial<AdminUpdateSummary> = {},
): AdminUpdateSummary => ({
  affectedComponents: 0,
  checkedComponents: 3,
  core: { latestVersion: null, state: "checked", version: "2.0.0" },
  enabled: true,
  failedComponents: 0,
  lastAttemptAt: "2026-10-15T03:00:00.000Z",
  notCheckedComponents: 0,
  oldestSuccessAt: "2026-10-15T03:00:00.000Z",
  pluginUpdatesAvailable: 0,
  running: false,
  stale: false,
  totalComponents: 3,
  unconfirmedComponents: 0,
  updatesAvailable: 0,
  ...overrides,
});

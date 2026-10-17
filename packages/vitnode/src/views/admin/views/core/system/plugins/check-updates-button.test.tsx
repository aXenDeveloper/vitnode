import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CheckPluginUpdatesResult } from "./plugin-updates-query";

import { AdminStaffPermissionProvider } from "@/components/staff-permission/provider";
import { updateSummary } from "@/tests/update-summary";

import { CheckUpdatesButton } from "./check-updates-button";
import {
  updateSummaryQueryKey,
  useAdminUpdateSummary,
} from "./update-summary-query";

/** Stands in for the navigation badge, the banner and the widget: any reader of the summary. */
const SummaryReader = () => {
  useAdminUpdateSummary();

  return null;
};

describe("CheckUpdatesButton", () => {
  it.each<CheckPluginUpdatesResult>([
    { failedSources: 0, securityUpdates: 0, status: "completed", updates: 2 },
    { retryAfterSeconds: null, status: "interrupted" },
  ])(
    "asks for the shared update summary again after a $status check",
    async result => {
      const queryClient = new QueryClient();
      queryClient.setQueryData(updateSummaryQueryKey, updateSummary());
      const refetched: unknown[] = [];
      queryClient.getQueryCache().subscribe(event => {
        if (event.type === "updated" && event.action.type === "fetch") {
          refetched.push(event.query.queryKey);
        }
      });

      render(
        <AdminStaffPermissionProvider value={{ permissions: [], root: true }}>
          <QueryClientProvider client={queryClient}>
            <SummaryReader />
            <CheckUpdatesButton
              onCheck={async () => await Promise.resolve(result)}
            />
          </QueryClientProvider>
        </AdminStaffPermissionProvider>,
      );
      expect(refetched).toEqual([]);

      const button = screen.getByRole("button", {
        name: "admin.system.plugins.updates.check.button",
      });
      fireEvent.submit(button.closest("form") as HTMLFormElement);

      await waitFor(() => {
        expect(refetched).toContainEqual(updateSummaryQueryKey);
      });
    },
  );
});

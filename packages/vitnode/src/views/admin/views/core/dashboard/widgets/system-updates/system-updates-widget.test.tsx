import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminUpdateSummary } from "@/views/admin/views/core/system/plugins/update-summary-query";

import { AdminStaffPermissionProvider } from "@/components/staff-permission/provider";
import { updateSummary as summary } from "@/tests/update-summary";
import { updateSummaryQueryKey } from "@/views/admin/views/core/system/plugins/update-summary-query";

import { SystemUpdatesWidget } from "./system-updates-widget";

const T = "admin.dashboard.widgets.system-updates";

const renderWidget = async (data: AdminUpdateSummary) => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(updateSummaryQueryKey, data);
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/admin"] }),
    routeTree: createRootRoute({ component: SystemUpdatesWidget }),
  });

  render(
    <IntlProvider locale="en" messages={{}} timeZone="UTC">
      <AdminStaffPermissionProvider value={{ permissions: [], root: true }}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </AdminStaffPermissionProvider>
    </IntlProvider>,
  );
  await screen.findByText(`${T}.view_plugins`);
};

const NOT_CHECKED = summary({
  checkedComponents: 0,
  core: { latestVersion: null, state: "not_checked", version: "2.0.0" },
  lastAttemptAt: null,
  notCheckedComponents: 3,
  oldestSuccessAt: null,
  unconfirmedComponents: 3,
});

describe("SystemUpdatesWidget", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["nothing was checked yet", NOT_CHECKED, `${T}.freshness.not_checked`],
    [
      "checks are turned off",
      summary({ enabled: false }),
      `${T}.freshness.disabled`,
    ],
  ])(
    "shows the counts as unknown, never 0, while %s",
    async (_, data, status) => {
      await renderWidget(data);

      expect(screen.getByText(status)).toBeTruthy();
      expect(screen.getAllByText(`${T}.unknown`)).toHaveLength(2);
      expect(screen.queryByText("0")).toBeNull();
      expect(screen.queryByText(`${T}.up_to_date`)).toBeNull();
    },
  );

  it("calls everything up to date only once every component is confirmed", async () => {
    await renderWidget(summary());

    expect(screen.getByText(`${T}.freshness.checked`)).toBeTruthy();
    expect(screen.getByText(`${T}.up_to_date`)).toBeTruthy();
  });

  it.each([
    ["a result is stale", { stale: true }],
    ["a check failed", { failedComponents: 1 }],
    ["a component cannot be confirmed", { unconfirmedComponents: 1 }],
    ["a security update applies", { affectedComponents: 1 }],
  ])(
    "does not call it up to date when %s",
    async (_, overrides: Partial<AdminUpdateSummary>) => {
      await renderWidget(summary(overrides));

      expect(screen.queryByText(`${T}.up_to_date`)).toBeNull();
    },
  );
});

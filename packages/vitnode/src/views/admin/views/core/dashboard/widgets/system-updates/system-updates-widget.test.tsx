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

const renderWidget = async (data?: AdminUpdateSummary) => {
  const queryClient = new QueryClient();
  if (data !== undefined) queryClient.setQueryData(updateSummaryQueryKey, data);
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

describe("SystemUpdatesWidget", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    [
      "nothing was checked yet",
      summary({
        checkedComponents: 0,
        lastAttemptAt: null,
        notCheckedComponents: 3,
        oldestSuccessAt: null,
      }),
      2,
    ],
    ["checks are turned off", summary({ enabled: false }), 3],
  ])(
    "shows the counts as unknown, never 0, while %s",
    async (_, data, unknown) => {
      await renderWidget(data);

      expect(screen.getAllByText(`${T}.unknown`)).toHaveLength(unknown);
      expect(screen.queryByText("0")).toBeNull();
      expect(screen.queryByText(`${T}.security_none`)).toBeNull();
    },
  );

  it("shows the checked counts and the newer core version", async () => {
    await renderWidget(
      summary({
        affectedComponents: 1,
        core: { latestVersion: "2.1.0", version: "2.0.0" },
        pluginUpdatesAvailable: 2,
      }),
    );

    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText(`${T}.core_update`)).toBeTruthy();
    expect(screen.getByText(`${T}.security_affected`)).toBeTruthy();
    expect(screen.queryByText(`${T}.unknown`)).toBeNull();
  });

  it("points to the plugins page when the summary cannot load", async () => {
    await renderWidget();

    expect(await screen.findByText(`${T}.load_error`)).toBeTruthy();
  });
});

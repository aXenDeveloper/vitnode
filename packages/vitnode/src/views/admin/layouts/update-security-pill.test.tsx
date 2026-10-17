import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminUpdateSummary } from "@/views/admin/views/core/system/plugins/update-summary-query";

import { AdminStaffPermissionProvider } from "@/components/staff-permission/provider";
import {
  componentUpdate,
  installedPlugin,
  pluginUpdates,
  securityFinding,
} from "@/tests/plugin-updates";
import { updateSummary as summary } from "@/tests/update-summary";
import { pluginUpdatesQueryKey } from "@/views/admin/views/core/system/plugins/plugin-updates-query";
import { installedPluginsQueryKey } from "@/views/admin/views/core/system/plugins/plugins-query";
import { updateSummaryQueryKey } from "@/views/admin/views/core/system/plugins/update-summary-query";

import { AdminUpdateSecurityPill } from "./update-security-pill";

const T = "admin.global.updates.security_pill";

const SECURE_PLUGINS = ["a", "b", "c", "d", "e"].map(id =>
  componentUpdate(`@acme/${id}`, {
    securityUpdates: [securityFinding("2.0.0")],
  }),
);

const renderPill = async (data: AdminUpdateSummary) => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(updateSummaryQueryKey, data);
  queryClient.setQueryData(
    pluginUpdatesQueryKey,
    pluginUpdates(componentUpdate("core"), SECURE_PLUGINS),
  );
  queryClient.setQueryData(installedPluginsQueryKey, {
    core: { author: null, license: null, version: "2.0.0" },
    frontendInventory: true,
    plugins: [installedPlugin("@acme/a", "Alpha")],
  });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/admin"] }),
    routeTree: createRootRoute({
      component: () => (
        <>
          <p>page</p>
          <AdminUpdateSecurityPill />
        </>
      ),
    }),
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
  await screen.findByText("page");
};

describe("AdminUpdateSecurityPill", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["nothing is affected", summary()],
    [
      "checks are turned off",
      summary({ affectedComponents: 1, enabled: false }),
    ],
  ])("stays hidden when %s", async (_, data) => {
    await renderPill(data);

    expect(screen.queryByRole("button", { name: `${T}.label` })).toBeNull();
  });

  it("lists the security and other updates once opened", async () => {
    await renderPill(summary({ affectedComponents: 5 }));

    fireEvent.click(screen.getByRole("button", { name: `${T}.label` }));

    const security = await screen.findByRole("region", {
      name: `${T}.security 5`,
    });
    expect(within(security).getByText("Alpha")).toBeTruthy();
    expect(within(security).getByText("@acme/d")).toBeTruthy();
    expect(within(security).queryByText("@acme/e")).toBeNull();
    expect(within(security).getByText(`${T}.more`)).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: `${T}.other 1` })).getByText(
        `${T}.core`,
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: `${T}.open_plugins` }),
    ).toBeTruthy();
  });
});

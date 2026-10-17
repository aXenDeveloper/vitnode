import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminUpdateSummary } from "@/views/admin/views/core/system/plugins/update-summary-query";

import { AdminStaffPermissionProvider } from "@/components/staff-permission/provider";
import { updateSummary as summary } from "@/tests/update-summary";
import { updateSummaryQueryKey } from "@/views/admin/views/core/system/plugins/update-summary-query";

import { ADMIN_PLUGINS_HREF } from "./sidebar/nav/nav-model";
import { AdminUpdateSecurityBanner } from "./update-security-banner";

const T = "admin.global.updates.security_banner";

const renderBanner = async (data: AdminUpdateSummary) => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(updateSummaryQueryKey, data);
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/admin"] }),
    routeTree: createRootRoute({
      component: () => (
        <>
          <p>page</p>
          <AdminUpdateSecurityBanner />
        </>
      ),
    }),
  });

  render(
    <AdminStaffPermissionProvider value={{ permissions: [], root: true }}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AdminStaffPermissionProvider>,
  );
  await screen.findByText("page");
};

describe("AdminUpdateSecurityBanner", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("warns about a security update and links to the plugins", async () => {
    await renderBanner(summary({ affectedComponents: 2 }));

    expect(
      screen.getByRole("region", { name: `${T}.title` }).textContent,
    ).not.toContain(`${T}.last_known`);
    expect(
      screen.getByRole("link", { name: `${T}.review` }).getAttribute("href"),
    ).toBe(ADMIN_PLUGINS_HREF);
  });

  it("says the finding is the last known one when a check failed since", async () => {
    await renderBanner(summary({ affectedComponents: 1, failedComponents: 1 }));

    expect(screen.getByText(`${T}.last_known`)).toBeTruthy();
  });

  it.each([
    ["nothing is affected", summary()],
    [
      "checks are turned off",
      summary({ affectedComponents: 1, enabled: false }),
    ],
  ])("stays hidden when %s", async (_, data) => {
    await renderBanner(data);

    expect(screen.queryByRole("region")).toBeNull();
  });
});

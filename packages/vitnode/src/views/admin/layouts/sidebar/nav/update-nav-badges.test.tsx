import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StaffPermissionSet } from "@/api/lib/permission-staff";
import type { AdminUpdateSummary } from "@/views/admin/views/core/system/plugins/update-summary-query";

import { AdminStaffPermissionProvider } from "@/components/staff-permission/provider";
import { updateSummary as summary } from "@/tests/update-summary";
import { updateSummaryQueryKey } from "@/views/admin/views/core/system/plugins/update-summary-query";

import { NavBadge, useAdminNavBadges } from "./nav-badges";
import { ADMIN_PLUGINS_HREF } from "./nav-model";
import { AdminUpdateNavBadges } from "./update-nav-badges";

const LABEL = "admin.global.updates.nav_badge";

const PluginsItemBadge = () => (
  <NavBadge badge={useAdminNavBadges()[ADMIN_PLUGINS_HREF]} />
);

const renderBadges = (
  data: AdminUpdateSummary,
  permissions: StaffPermissionSet = { permissions: [], root: true },
) => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(updateSummaryQueryKey, data);

  return render(
    <AdminStaffPermissionProvider value={permissions}>
      <QueryClientProvider client={queryClient}>
        <AdminUpdateNavBadges>
          <PluginsItemBadge />
        </AdminUpdateNavBadges>
      </QueryClientProvider>
    </AdminStaffPermissionProvider>,
  );
};

describe("AdminUpdateNavBadges", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("counts the available updates next to Plugins", () => {
    renderBadges(summary({ updatesAvailable: 3 }));

    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText(LABEL)).toBeTruthy();
  });

  it.each([
    ["nothing to update", summary(), undefined],
    [
      "checks turned off",
      summary({ enabled: false, updatesAvailable: 3 }),
      undefined,
    ],
    [
      "staff who cannot view plugins",
      summary({ updatesAvailable: 3 }),
      { permissions: [], root: false },
    ],
  ])("shows no badge for %s", (_, data, permissions) => {
    renderBadges(data, permissions);

    expect(screen.queryByText(LABEL)).toBeNull();
  });
});

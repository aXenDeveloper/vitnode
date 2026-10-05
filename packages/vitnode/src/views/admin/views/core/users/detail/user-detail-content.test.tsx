import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StaffPermissionSet } from "@/api/lib/permission-staff";

import { adminUserFixture } from "@/tests/admin-user";

import type { AdminUserDetail } from "./user-query";

import { UserDetailContent } from "./user-detail-content";
import { canEditAdminUser } from "./user-query";

const permissionSet = (...permissions: string[]): StaffPermissionSet => ({
  permissions: permissions.map(permission => ({
    module: "users",
    permission,
    plugin: "@vitnode/core",
  })),
  root: false,
});

const mount = async ({
  permissions,
  user,
}: {
  permissions: StaffPermissionSet;
  user: AdminUserDetail;
}) => {
  const rootRoute = createRootRoute({
    component: () => (
      <UserDetailContent
        canEdit={canEditAdminUser(permissions, user)}
        connectedAccounts={<p>connected accounts slot</p>}
        devices={<p>devices slot</p>}
        notifications={<p>notifications slot</p>}
        onRemoveImage={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateRoles={vi.fn()}
        onUploadImage={vi.fn()}
        onVerifyEmail={vi.fn()}
        searchRoles={vi.fn()}
        security={<p>security slot</p>}
        timeline={<p>timeline slot</p>}
        user={user}
      />
    ),
  });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree: rootRoute,
  });

  render(
    <IntlProvider locale="en" messages={{}} timeZone="UTC">
      <RouterProvider router={router} />
    </IntlProvider>,
  );

  await screen.findByText("admin.user.show.rolesTitle");
};

const editControls = () => [
  screen.queryByRole("button", { name: "admin.user.show.editName" }),
  screen.queryByRole("button", { name: "admin.user.show.editEmail" }),
  screen.queryByRole("button", { name: "admin.user.show.editRoles" }),
  screen.queryByRole("button", { name: "admin.user.show.personal.edit" }),
  screen.queryByRole("button", { name: "admin.user.show.preferences.edit" }),
];

describe("UserDetailContent edit controls for a staff target", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        disconnect() {}
        observe() {}
        unobserve() {}
      },
    );
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        addEventListener: vi.fn(),
        matches: false,
        removeEventListener: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hides them for a moderator when the viewer lacks users:can_edit_admin", async () => {
    await mount({
      permissions: permissionSet("can_edit"),
      user: adminUserFixture({ isStaff: true }),
    });

    for (const control of editControls()) {
      expect(control).toBeNull();
    }
  });

  it("shows them for a moderator when the viewer holds users:can_edit_admin", async () => {
    await mount({
      permissions: permissionSet("can_edit", "can_edit_admin"),
      user: adminUserFixture({ isStaff: true }),
    });

    for (const control of editControls()) {
      expect(control).not.toBeNull();
    }
  });

  it("shows them for a member with users:can_edit alone", async () => {
    await mount({
      permissions: permissionSet("can_edit"),
      user: adminUserFixture(),
    });

    for (const control of editControls()) {
      expect(control).not.toBeNull();
    }
  });

  it("offers to verify the email only while it is unverified", async () => {
    await mount({
      permissions: permissionSet("can_edit"),
      user: adminUserFixture({ emailVerified: false }),
    });

    expect(
      screen.getByRole("button", { name: "admin.user.show.verify.action" }),
    ).not.toBeNull();
    expect(
      screen.getByText("admin.user.show.badges.unverified"),
    ).not.toBeNull();
  });

  it("does not offer to verify an already verified email", async () => {
    await mount({
      permissions: permissionSet("can_edit"),
      user: adminUserFixture(),
    });

    expect(
      screen.queryByRole("button", { name: "admin.user.show.verify.action" }),
    ).toBeNull();
  });

  it("shows the activity tab first and switches to the notifications tab", async () => {
    await mount({
      permissions: permissionSet("can_edit"),
      user: adminUserFixture(),
    });

    expect(screen.getByText("timeline slot")).not.toBeNull();
    expect(screen.getByText("connected accounts slot")).not.toBeNull();
    expect(screen.getByText("devices slot")).not.toBeNull();
    expect(screen.queryByText("notifications slot")).toBeNull();

    fireEvent.click(
      screen.getByRole("tab", {
        name: /admin\.user\.show\.tabs\.notifications/,
      }),
    );

    expect(await screen.findByText("notifications slot")).not.toBeNull();
  });
});

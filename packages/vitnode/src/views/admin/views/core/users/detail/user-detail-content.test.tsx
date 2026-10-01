import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StaffPermissionSet } from "@/api/lib/permission-staff";

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

const MEMBER_ROLE = { color: null, id: 3, name: [] };

const userFixture = (isStaff: boolean): AdminUserDetail => ({
  avatarColor: "#123456",
  avatarUrl: null,
  birthday: null,
  coverUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  email: "moderator@example.com",
  emailVerified: true,
  id: 7,
  imagePolicy: {
    avatar: { allowed: true, maxBytes: 1_000_000 },
    cover: { allowed: true, maxBytes: 1_000_000 },
  },
  isStaff,
  language: "en",
  name: "Moderator",
  nameCode: "moderator",
  newsletter: false,
  role: MEMBER_ROLE,
  roleId: MEMBER_ROLE.id,
  secondaryRoles: [],
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
        onRemoveImage={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateRoles={vi.fn()}
        onUploadImage={vi.fn()}
        searchRoles={vi.fn()}
        timeline={null}
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
      user: userFixture(true),
    });

    for (const control of editControls()) {
      expect(control).toBeNull();
    }
  });

  it("shows them for a moderator when the viewer holds users:can_edit_admin", async () => {
    await mount({
      permissions: permissionSet("can_edit", "can_edit_admin"),
      user: userFixture(true),
    });

    for (const control of editControls()) {
      expect(control).not.toBeNull();
    }
  });

  it("shows them for a member with users:can_edit alone", async () => {
    await mount({
      permissions: permissionSet("can_edit"),
      user: userFixture(false),
    });

    for (const control of editControls()) {
      expect(control).not.toBeNull();
    }
  });
});

// @vitest-environment node
import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import { core_admin_permissions } from "@/database/admins";
import { core_moderators_permissions } from "@/database/moderators";
import { core_roles } from "@/database/roles";
import { core_users, core_users_secondary_roles } from "@/database/users";
import { createTestCache } from "@/tests/cache";
import { createMemoryDb } from "@/tests/memory-db";
import {
  grantStaffPermissions,
  ROOT_STAFF_PERMISSIONS,
} from "@/tests/staff-permissions";

import {
  assertCanAssignRoles,
  assertCanEditAdminTarget,
} from "./assert-edit-user-permission";

const CALLER = { id: 1, roleId: 2 };
const TARGET_ID = 7;

const ROOT_ROLE = 1;
const MEMBER_ROLE = 3;
const STAFF_ROLE = 9;

const permission = (name: string, module = "users"): PermissionsStaffArgs => ({
  module,
  permission: name,
  plugin: "@vitnode/core",
});

const CAN_EDIT = permission("can_edit");
const CAN_EDIT_ADMIN = permission("can_edit_admin");
const CAN_MANAGE_PLUGINS = permission("can_manage", "plugins");
const CAN_DELETE_POSTS = permission("can_delete", "posts");

interface StaffEntry {
  permissions?: PermissionsStaffArgs[];
  roleId?: number;
  unrestricted?: boolean;
  userId?: number;
}

interface World {
  admin?: StaffEntry[];
  moderator?: StaffEntry[];
  secondaryRoleIds?: number[];
}

interface Caller {
  admin: PermissionsStaffArgs[] | typeof ROOT_STAFF_PERMISSIONS;
  moderator?: PermissionsStaffArgs[] | typeof ROOT_STAFF_PERMISSIONS;
}

const entryRow = (entry: StaffEntry) => ({
  permissions: [],
  roleId: null,
  unrestricted: false,
  userId: null,
  ...entry,
});

const contextFor = async (world: World, caller: Caller): Promise<Context> => {
  const cache = createTestCache();
  await grantStaffPermissions(cache, {
    permissions: caller.admin,
    userId: CALLER.id,
  });
  if (caller.moderator) {
    await grantStaffPermissions(cache, {
      permissions: caller.moderator,
      type: "moderator",
      userId: CALLER.id,
    });
  }

  const { db } = createMemoryDb([
    [core_users, [CALLER, { id: TARGET_ID, roleId: MEMBER_ROLE }]],
    [
      core_users_secondary_roles,
      (world.secondaryRoleIds ?? []).map(roleId => ({
        roleId,
        userId: TARGET_ID,
      })),
    ],
    [
      core_roles,
      [
        { id: ROOT_ROLE, root: true },
        { id: CALLER.roleId, root: false },
        { id: MEMBER_ROLE, root: false },
        { id: STAFF_ROLE, root: false },
      ],
    ],
    [core_admin_permissions, (world.admin ?? []).map(entryRow)],
    [core_moderators_permissions, (world.moderator ?? []).map(entryRow)],
  ]);
  const values: Record<string, unknown> = {
    admin: { user: CALLER },
    cache,
    db,
  };

  return { get: (key: string) => values[key] } as unknown as Context;
};

const assign = async (
  world: World,
  roleIds: number[],
  caller: Caller,
): Promise<void> => {
  await assertCanAssignRoles(await contextFor(world, caller), roleIds);
};

const ELEVATED_ADMIN: Caller = { admin: [CAN_EDIT, CAN_EDIT_ADMIN] };
const ROOT_CALLER: Caller = { admin: ROOT_STAFF_PERMISSIONS };

describe("assertCanAssignRoles", () => {
  it("lets an ordinary role through without an elevated check", async () => {
    await expect(
      assign({ admin: [{ roleId: STAFF_ROLE }] }, [MEMBER_ROLE], { admin: [] }),
    ).resolves.toBeUndefined();
  });

  it("asks for nothing when no roles are being assigned", async () => {
    await expect(assign({}, [], { admin: [] })).resolves.toBeUndefined();
  });

  const staffRoles: [string, World, number][] = [
    [
      "a role with an admin entry",
      { admin: [{ roleId: STAFF_ROLE }] },
      STAFF_ROLE,
    ],
    ["a root role", {}, ROOT_ROLE],
    [
      "a role with a moderator entry",
      { moderator: [{ roleId: STAFF_ROLE }] },
      STAFF_ROLE,
    ],
  ];

  it.each(staffRoles)(
    "requires users:can_edit_admin for %s",
    async (_label, world, roleId) => {
      await expect(
        assign(world, [roleId], { admin: [CAN_EDIT] }),
      ).rejects.toMatchObject({ status: 403 });
    },
  );

  it.each(staffRoles)(
    "lets a root caller assign %s",
    async (_label, world, roleId) => {
      await expect(
        assign(world, [roleId], ROOT_CALLER),
      ).resolves.toBeUndefined();
    },
  );

  it("allows a zero-permission staff role with users:can_edit_admin", async () => {
    await expect(
      assign(
        {
          admin: [{ roleId: STAFF_ROLE }],
          moderator: [{ roleId: STAFF_ROLE }],
        },
        [STAFF_ROLE],
        ELEVATED_ADMIN,
      ),
    ).resolves.toBeUndefined();
  });

  it("refuses the root role to a caller who is not root", async () => {
    await expect(assign({}, [ROOT_ROLE], ELEVATED_ADMIN)).rejects.toMatchObject(
      { status: 403 },
    );
  });

  it("refuses the root role to a caller who is root only as a moderator", async () => {
    await expect(
      assign({}, [ROOT_ROLE], {
        ...ELEVATED_ADMIN,
        moderator: ROOT_STAFF_PERMISSIONS,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("refuses a role with an unrestricted admin entry to a caller who is not root", async () => {
    await expect(
      assign(
        { admin: [{ roleId: STAFF_ROLE, unrestricted: true }] },
        [STAFF_ROLE],
        ELEVATED_ADMIN,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("refuses a role with an unrestricted moderator entry unless the caller is root there", async () => {
    const world = {
      moderator: [{ roleId: STAFF_ROLE, unrestricted: true }],
    };

    await expect(
      assign(world, [STAFF_ROLE], ELEVATED_ADMIN),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      assign(world, [STAFF_ROLE], {
        ...ELEVATED_ADMIN,
        moderator: ROOT_STAFF_PERMISSIONS,
      }),
    ).resolves.toBeUndefined();
  });

  it("refuses an admin permission the caller does not hold", async () => {
    const world = {
      admin: [{ permissions: [CAN_MANAGE_PLUGINS], roleId: STAFF_ROLE }],
    };

    await expect(
      assign(world, [STAFF_ROLE], ELEVATED_ADMIN),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      assign(world, [STAFF_ROLE], {
        admin: [CAN_EDIT, CAN_EDIT_ADMIN, CAN_MANAGE_PLUGINS],
      }),
    ).resolves.toBeUndefined();
  });

  it("checks moderator permissions against the caller's moderator set", async () => {
    const world = {
      moderator: [{ permissions: [CAN_DELETE_POSTS], roleId: STAFF_ROLE }],
    };

    await expect(
      assign(world, [STAFF_ROLE], {
        admin: [CAN_EDIT, CAN_EDIT_ADMIN, CAN_DELETE_POSTS],
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      assign(world, [STAFF_ROLE], {
        ...ELEVATED_ADMIN,
        moderator: [CAN_DELETE_POSTS],
      }),
    ).resolves.toBeUndefined();
  });

  it("catches a staff role hidden among ordinary ones", async () => {
    await expect(
      assign({}, [MEMBER_ROLE, CALLER.roleId, ROOT_ROLE], {
        admin: [CAN_EDIT],
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("propagates the refusal when the caller lacks the permission", async () => {
    await expect(assign({}, [ROOT_ROLE], { admin: [] })).rejects.toBeInstanceOf(
      HTTPException,
    );
  });

  it("decides a role list with duplicates like the single role", async () => {
    const world = { admin: [{ roleId: STAFF_ROLE }] };

    await expect(
      assign(world, [STAFF_ROLE, STAFF_ROLE, STAFF_ROLE], ELEVATED_ADMIN),
    ).resolves.toBeUndefined();
    await expect(
      assign(world, [STAFF_ROLE, STAFF_ROLE, STAFF_ROLE], {
        admin: [CAN_EDIT],
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("assertCanEditAdminTarget", () => {
  const protectedTargets: [string, World][] = [
    ["root through a secondary role", { secondaryRoleIds: [ROOT_ROLE] }],
    [
      "an admin through a secondary role",
      { admin: [{ roleId: STAFF_ROLE }], secondaryRoleIds: [STAFF_ROLE] },
    ],
    ["an admin with zero permissions", { admin: [{ userId: TARGET_ID }] }],
    [
      "a moderator",
      { moderator: [{ permissions: [CAN_DELETE_POSTS], userId: TARGET_ID }] },
    ],
  ];

  it.each(protectedTargets)(
    "requires users:can_edit_admin for a target who is %s",
    async (_label, world) => {
      await expect(
        assertCanEditAdminTarget(
          await contextFor(world, { admin: [CAN_EDIT] }),
          TARGET_ID,
        ),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        assertCanEditAdminTarget(
          await contextFor(world, ELEVATED_ADMIN),
          TARGET_ID,
        ),
      ).resolves.toBeUndefined();
    },
  );

  it("lets users:can_edit alone edit a member", async () => {
    await expect(
      assertCanEditAdminTarget(
        await contextFor({}, { admin: [CAN_EDIT] }),
        TARGET_ID,
      ),
    ).resolves.toBeUndefined();
  });
});

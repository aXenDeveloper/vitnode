import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";

import type { CacheModel } from "@/api/lib/cache";
import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import { core_admin_permissions } from "@/database/admins";
import { core_moderators_permissions } from "@/database/moderators";
import { core_roles } from "@/database/roles";
import { createTestCache } from "@/tests/cache";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { assertCanAssignRoles } from "./assert-edit-user-permission";

const ADMIN = { id: 1, roleId: 1 };

const CAN_EDIT_ADMIN: PermissionsStaffArgs = {
  module: "users",
  permission: "can_edit_admin",
  plugin: "@vitnode/core",
};

const CAN_EDIT: PermissionsStaffArgs = {
  ...CAN_EDIT_ADMIN,
  permission: "can_edit",
};

/**
 * Which roles the fake database considers staff-granting, by the table that
 * would say so. The guard runs one query per table, so the stub answers by
 * which table the query named.
 */
interface StaffRoles {
  admin?: number[];
  moderator?: number[];
  root?: number[];
}

/**
 * A stand-in for the Drizzle query builder: `.select().from(t).where().limit()`
 * resolves to a row when `t`'s set contains any of the roles under test.
 *
 * A stub rather than a database because the thing worth asserting is the
 * *decision* - "does attaching these roles need `can_edit_admin`" - and that is
 * three lookups and a boolean, not a schema.
 */
const contextWith = (
  staff: StaffRoles,
  roleIds: number[],
  cache: CacheModel,
): Context => {
  const idsFor = (table: unknown): number[] => {
    if (table === core_roles) return staff.root ?? [];
    if (table === core_admin_permissions) return staff.admin ?? [];
    if (table === core_moderators_permissions) return staff.moderator ?? [];

    throw new Error("unexpected table");
  };

  const db = {
    select: () => ({
      from: (table: unknown) => {
        const matches = idsFor(table).filter(id => roleIds.includes(id));

        return {
          where: () => ({
            limit: async () =>
              await Promise.resolve(matches.map(id => ({ id }))),
          }),
        };
      },
    }),
  };

  const values: Record<string, unknown> = { admin: { user: ADMIN }, cache, db };

  return { get: (key: string) => values[key] } as Context;
};

const assign = async (
  staff: StaffRoles,
  roleIds: number[],
  permissions: PermissionsStaffArgs[],
): Promise<void> => {
  const cache = createTestCache();
  await grantStaffPermissions(cache, { permissions, userId: ADMIN.id });
  await assertCanAssignRoles(contextWith(staff, roleIds, cache), roleIds);
};

describe("assertCanAssignRoles", () => {
  it("lets an ordinary role through without an elevated check", async () => {
    await expect(
      assign({ admin: [9], root: [9] }, [2], []),
    ).resolves.toBeUndefined();
  });

  it("asks for nothing when no roles are being assigned", async () => {
    await expect(assign({ admin: [9] }, [], [])).resolves.toBeUndefined();
  });

  const staffRoles: [string, StaffRoles][] = [
    ["a role with an admin-permissions row", { admin: [9] }],
    ["a root role", { root: [9] }],
    ["a role with a moderator-permissions row", { moderator: [9] }],
  ];

  it.each(staffRoles)(
    "requires users:can_edit_admin for %s",
    async (_label, staff) => {
      await expect(assign(staff, [9], [CAN_EDIT])).rejects.toMatchObject({
        status: 403,
      });
    },
  );

  it.each(staffRoles)(
    "allows %s with users:can_edit_admin alone",
    async (_label, staff) => {
      await expect(
        assign(staff, [9], [CAN_EDIT_ADMIN]),
      ).resolves.toBeUndefined();
    },
  );

  it("catches a staff role hidden among ordinary ones", async () => {
    // The escalation this guard exists for: a `users:can_edit` administrator
    // sending `secondaryRoleIds: [2, 3, <root>]`. Guarding only the primary role
    // let the whole secondary list past, and a secondary root role grants
    // everything - `loadStaffPermissions` reads primary and secondary alike.
    await expect(
      assign({ root: [9] }, [2, 3, 9], [CAN_EDIT]),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("propagates the refusal when the caller lacks the permission", async () => {
    await expect(assign({ root: [9] }, [9], [])).rejects.toBeInstanceOf(
      HTTPException,
    );
  });

  it("decides a role list with duplicates like the single role", async () => {
    await expect(
      assign({ admin: [9] }, [9, 9, 9], [CAN_EDIT_ADMIN]),
    ).resolves.toBeUndefined();
    await expect(
      assign({ admin: [9] }, [9, 9, 9], [CAN_EDIT]),
    ).rejects.toMatchObject({ status: 403 });
  });
});

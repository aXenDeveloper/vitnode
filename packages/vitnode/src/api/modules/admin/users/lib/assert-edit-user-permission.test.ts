import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";
import { describe, expect, it, vi } from "vitest";

import { core_admin_permissions } from "@/database/admins";
import { core_moderators_permissions } from "@/database/moderators";
import { core_roles } from "@/database/roles";

import { assertCanAssignRoles } from "./assert-edit-user-permission";

const assertStaffPermission = vi.hoisted(() => vi.fn());

vi.mock("@/api/lib/check-staff-permission", () => ({
  assertStaffPermission,
}));

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
const contextWith = (staff: StaffRoles, roleIds: number[]): Context => {
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

  return { get: (key: string) => (key === "db" ? db : undefined) } as Context;
};

const assign = async (staff: StaffRoles, roleIds: number[]): Promise<void> => {
  await assertCanAssignRoles(contextWith(staff, roleIds), roleIds);
};

describe("assertCanAssignRoles", () => {
  it("lets an ordinary role through without an elevated check", async () => {
    assertStaffPermission.mockClear();
    await assign({ admin: [9], root: [9] }, [2]);

    expect(assertStaffPermission).not.toHaveBeenCalled();
  });

  it("asks for nothing when no roles are being assigned", async () => {
    assertStaffPermission.mockClear();
    await assign({ admin: [9] }, []);

    expect(assertStaffPermission).not.toHaveBeenCalled();
  });

  it.each([
    ["a role with an admin-permissions row", { admin: [9] }],
    ["a root role", { root: [9] }],
    ["a role with a moderator-permissions row", { moderator: [9] }],
  ])("requires users:can_edit_admin for %s", async (_label, staff) => {
    assertStaffPermission.mockClear();
    await assign(staff, [9]);

    expect(assertStaffPermission).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        module: "users",
        permission: "can_edit_admin",
        type: "admin",
      }),
    );
  });

  it("catches a staff role hidden among ordinary ones", async () => {
    // The escalation this guard exists for: a `users:can_edit` administrator
    // sending `secondaryRoleIds: [2, 3, <root>]`. Guarding only the primary role
    // let the whole secondary list past, and a secondary root role grants
    // everything - `loadStaffPermissions` reads primary and secondary alike.
    assertStaffPermission.mockClear();
    await assign({ root: [9] }, [2, 3, 9]);

    expect(assertStaffPermission).toHaveBeenCalledOnce();
  });

  it("propagates the refusal when the caller lacks the permission", async () => {
    assertStaffPermission.mockClear();
    assertStaffPermission.mockRejectedValueOnce(new HTTPException(403));

    await expect(assign({ root: [9] }, [9])).rejects.toBeInstanceOf(
      HTTPException,
    );
  });

  it("checks a role list with duplicates once", async () => {
    assertStaffPermission.mockClear();
    await assign({ admin: [9] }, [9, 9, 9]);

    expect(assertStaffPermission).toHaveBeenCalledOnce();
  });
});

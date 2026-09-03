// @vitest-environment node
import type { QueryClient } from "@tanstack/react-query";

import { describe, expect, it } from "vitest";

import { ADMIN_QUERY_ROOT } from "@/views/admin/table/query";
import { adminUsersQueryRoot } from "@/views/admin/views/core/users/list/users-query";

import { ADMIN_SESSION_QUERY_KEY } from "../state";
import {
  invalidateAdminUsers,
  invalidateAfterAdminUserRolesChange,
} from "./query";

/** Every `queryKey` a call named, in the order it named them. */
const recorder = () => {
  const invalidated: unknown[][] = [];
  const removed: unknown[][] = [];

  return {
    invalidated,
    queryClient: {
      invalidateQueries: async ({ queryKey }: { queryKey: unknown[] }) => {
        invalidated.push(queryKey);

        return await Promise.resolve();
      },
      removeQueries: ({ queryKey }: { queryKey: unknown[] }) => {
        removed.push(queryKey);
      },
    } as unknown as QueryClient,
    removed,
  };
};

const ADMIN = 7;
const serialised = (keys: unknown[][]) => keys.map(key => JSON.stringify(key));

describe("changing a user's roles", () => {
  it("invalidates the users family for the reading administrator", async () => {
    const { invalidated, queryClient } = recorder();

    await invalidateAfterAdminUserRolesChange(queryClient, ADMIN);

    expect(serialised(invalidated)).toContain(
      JSON.stringify(adminUsersQueryRoot(ADMIN)),
    );
  });

  /** The finding. A role moves permissions, so the permission set is stale. */
  it("invalidates the admin session", async () => {
    const { invalidated, queryClient } = recorder();

    await invalidateAfterAdminUserRolesChange(queryClient, ADMIN);

    expect(serialised(invalidated)).toContain(
      JSON.stringify(ADMIN_SESSION_QUERY_KEY),
    );
  });

  it("does not remove the session", async () => {
    const { queryClient, removed } = recorder();

    await invalidateAfterAdminUserRolesChange(queryClient, ADMIN);

    expect(removed).toHaveLength(0);
  });

  it("names two prefixes and no more", async () => {
    const { invalidated, queryClient } = recorder();

    await invalidateAfterAdminUserRolesChange(queryClient, ADMIN);

    expect(invalidated).toHaveLength(2);
    invalidated.forEach(key => {
      expect(key.length, JSON.stringify(key)).toBeGreaterThan(1);
      expect(JSON.stringify(key)).not.toBe(JSON.stringify(["vitnode"]));
    });
  });

  it("cannot reach the session through the panel root", () => {
    const isPrefixOf = (
      prefix: readonly unknown[],
      key: readonly unknown[],
    ): boolean => prefix.every((segment, index) => key[index] === segment);

    expect(isPrefixOf(ADMIN_QUERY_ROOT, ADMIN_SESSION_QUERY_KEY)).toBe(false);
    expect(
      isPrefixOf(adminUsersQueryRoot(ADMIN), ADMIN_SESSION_QUERY_KEY),
    ).toBe(false);
  });
});

describe("the other user writes stay on the users family", () => {
  it("invalidates exactly one prefix", async () => {
    const { invalidated, queryClient } = recorder();

    await invalidateAdminUsers(queryClient, ADMIN);

    expect(serialised(invalidated)).toEqual([
      JSON.stringify(adminUsersQueryRoot(ADMIN)),
    ]);
  });

  it("is a prefix of the roles change's own users target", async () => {
    const plain = recorder();
    const roles = recorder();

    await invalidateAdminUsers(plain.queryClient, ADMIN);
    await invalidateAfterAdminUserRolesChange(roles.queryClient, ADMIN);

    // The wider call is the narrower one plus the session, rather than a second
    // spelling of the same prefix that could drift from it.
    expect(serialised(roles.invalidated)).toEqual(
      expect.arrayContaining(serialised(plain.invalidated)),
    );
  });

  /** One administrator's invalidation never reaches another's entries. */
  it("stays inside the reading administrator's partition", async () => {
    const { invalidated, queryClient } = recorder();

    await invalidateAfterAdminUserRolesChange(queryClient, ADMIN);

    const usersTarget = invalidated.find(
      key => JSON.stringify(key) === JSON.stringify(adminUsersQueryRoot(ADMIN)),
    );

    expect(usersTarget).toBeDefined();
    expect(JSON.stringify(usersTarget)).not.toBe(
      JSON.stringify(adminUsersQueryRoot(ADMIN + 1)),
    );
  });
});

import type { Context } from "hono";

import { describe, expect, it, vi } from "vitest";

import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";
import { createMemoryDb } from "@/tests/memory-db";

import { signUp } from "./sign-up";

const ROOT_ROLE = 1;
const MEMBER_ROLE = 2;

const harness = () => {
  const memory = createMemoryDb([
    [
      core_roles,
      [
        { default: false, id: ROOT_ROLE, root: true },
        { default: true, id: MEMBER_ROLE, root: false },
      ],
    ],
    [core_users, []],
  ]);
  const vars: Record<string, unknown> = {
    core: {},
    db: memory.db,
    events: { emit: vi.fn(async () => Promise.resolve()) },
    ipAddress: "127.0.0.1",
  };
  const c = { get: (key: string) => vars[key] } as unknown as Context;

  const register = async (name: string) =>
    await signUp(
      {
        email: `${name}@example.com`,
        hashedPassword: "hashed",
        name,
      },
      c,
    );

  const roleIdsOfUsers = () =>
    memory
      .rows(core_users)
      .map(row => row.roleId)
      .sort((a, b) => Number(a) - Number(b));

  return { register, roleIdsOfUsers };
};

describe("signUp - first user", () => {
  it("gives the root role to the very first user and the default role after", async () => {
    const h = harness();

    const first = await h.register("first");
    const second = await h.register("second");

    expect(first.roleId).toBe(ROOT_ROLE);
    expect(first.emailVerified).toBe(true);
    expect(second.roleId).toBe(MEMBER_ROLE);
  });

  it("gives root to only one of two concurrent first sign-ups", async () => {
    const h = harness();

    const users = await Promise.all([
      h.register("alice"),
      h.register("bob"),
      h.register("carol"),
    ]);

    expect(users.filter(user => user.roleId === ROOT_ROLE)).toHaveLength(1);
    expect(h.roleIdsOfUsers()).toEqual([ROOT_ROLE, MEMBER_ROLE, MEMBER_ROLE]);
  });
});

import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { core_content_containers } from "@/database/content-containers";
import { core_users_secondary_roles } from "@/database/users";
import {
  accessTopics,
  BOARD,
  CATEGORY,
  createAccessWorld,
  ROLE,
  testAccessBoards,
  testAccessCategoryContentType,
  TOPIC,
  USER,
} from "@/tests/content-access";

import { createContentAccess, decideContentAccessForScopes } from "./decide";

const FAMILY = testAccessCategoryContentType.id;

describe("a record in several scopes", () => {
  const scopes = (...ids: number[]) =>
    ids.map(id => ({ family: FAMILY, scopeId: String(id) }));

  it.each([
    [null, [CATEGORY.MEMBERS], false],
    [USER.MEMBER, [CATEGORY.MEMBERS], true],
    [USER.MEMBER, [CATEGORY.VIP], false],
    // Allowed in one of its scopes is not enough: it needs every one.
    [USER.MEMBER, [CATEGORY.MEMBERS, CATEGORY.VIP], false],
    [USER.VIP, [CATEGORY.MEMBERS, CATEGORY.VIP], true],
  ])("user %s reading scopes %j: %s", async (userId, ids, expected) => {
    const world = await createAccessWorld();

    const decision = await decideContentAccessForScopes(
      world.contextFor(userId),
      { action: "read", scopes: scopes(...ids) },
    );

    expect(decision.allowed).toBe(expected);
  });

  it("lets nobody into a scope of a family the app does not have", async () => {
    const world = await createAccessWorld();

    const decision = await decideContentAccessForScopes(
      world.contextFor(USER.VIP),
      { action: "read", scopes: [{ family: "gone.family", scopeId: "1" }] },
    );

    expect(decision.allowed).toBe(false);
  });

  it("lets a root role read what no rule lets anybody else read", async () => {
    const world = await createAccessWorld({
      rules: {
        [FAMILY]: {
          [CATEGORY.MEMBERS]: { read: { mode: "roles", roleIds: [] } },
        },
      },
    });

    const decision = await decideContentAccessForScopes(
      world.contextFor(USER.ROOT),
      { action: "read", scopes: scopes(CATEGORY.MEMBERS) },
    );

    expect(decision).toEqual({ allowed: true, reason: "root" });
  });
});

describe("changes apply on the next request", () => {
  it("stops counting a secondary role the moment it is taken away", async () => {
    const world = await createAccessWorld();
    const canSeeVip = async () =>
      await createContentAccess(world.contextFor(USER.VIP)).canScope(
        testAccessBoards.id,
        BOARD.VIP,
        "view",
      );

    await expect(canSeeVip()).resolves.toBe(true);

    await world.memory.db
      .delete(core_users_secondary_roles)
      .where(
        and(
          eq(core_users_secondary_roles.userId, USER.VIP),
          eq(core_users_secondary_roles.roleId, ROLE.VIP),
        ),
      );

    await expect(canSeeVip()).resolves.toBe(false);
  });

  it("closes a container moved under a restricted parent", async () => {
    const world = await createAccessWorld();
    const canRead = async () =>
      await createContentAccess(world.contextFor(USER.MEMBER)).canRecord(
        accessTopics,
        TOPIC.OPEN_CHILD,
        "read",
      );

    await expect(canRead()).resolves.toBe(true);

    await world.memory.db
      .update(core_content_containers)
      .set({ parentId: BOARD.VIP })
      .where(eq(core_content_containers.id, BOARD.OPEN_CHILD));

    await expect(canRead()).resolves.toBe(false);
  });
});

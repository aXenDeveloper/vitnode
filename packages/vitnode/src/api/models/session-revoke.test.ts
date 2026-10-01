// @vitest-environment node
import { describe, expect, it } from "vitest";

import { ForgotPasswordTokenModel } from "@/api/models/password";
import { changePasswordRoute } from "@/api/modules/users/routes/change-password.route";
import { core_users_forgot_password } from "@/database/users";
import { createSessionWorld, fakeSession } from "@/tests/sessions";

import { invalidateSessionCacheForUser } from "./session-revoke";

const LAPTOP = { id: 3, publicId: "laptop" };
const PHONE = { id: 4, publicId: "phone" };

const onLaptop = fakeSession(7, LAPTOP);
const onPhone = fakeSession(7, PHONE);
const someoneElse = fakeSession(8, LAPTOP);
const everyone = [onLaptop, onPhone, someoneElse];

const RESET_TOKEN = "reset-token";

const setup = async () => {
  const world = await createSessionWorld({
    extraTables: [
      [
        core_users_forgot_password,
        [
          {
            expiresAt: new Date(Date.now() + 1000 * 60 * 10),
            id: 1,
            token: new ForgotPasswordTokenModel().hashResetToken(RESET_TOKEN),
            userId: 7,
          },
        ],
      ],
    ],
    sessions: everyone,
  });
  world.app.openapi(changePasswordRoute.route, changePasswordRoute.handler);
  world.app.post("/invalidate/:userId", async c => {
    await invalidateSessionCacheForUser(c, Number(c.req.param("userId")));

    return c.body(null, 204);
  });

  for (const session of everyone) {
    expect(await world.probe(session)).toEqual({ admin: 200, user: 200 });
  }

  return world;
};

describe("completing a password reset", () => {
  const resetPassword = async (world: Awaited<ReturnType<typeof setup>>) =>
    await world.app.request("/change-password", {
      body: JSON.stringify({
        password: "NewPassword1!",
        token: RESET_TOKEN,
        userId: 7,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

  it("ends every user and AdminCP session the user has, on every device", async () => {
    const world = await setup();

    const response = await resetPassword(world);

    expect(response.status).toBe(201);
    for (const session of [onLaptop, onPhone]) {
      expect(world.rowsFor(session)).toEqual({ admin: 0, user: 0 });
      expect(await world.isCached(session)).toEqual({
        admin: false,
        user: false,
      });
      expect(await world.probe(session)).toEqual({ admin: 401, user: 401 });
    }
  });

  it("leaves other users signed in", async () => {
    const world = await setup();

    await resetPassword(world);

    expect(world.rowsFor(someoneElse)).toEqual({ admin: 1, user: 1 });
    expect(await world.probe(someoneElse)).toEqual({ admin: 200, user: 200 });
  });
});

describe("invalidateSessionCacheForUser", () => {
  it("drops both cached session kinds and keeps the sessions", async () => {
    const world = await setup();

    await world.app.request("/invalidate/7", { method: "POST" });

    for (const session of [onLaptop, onPhone]) {
      expect(await world.isCached(session)).toEqual({
        admin: false,
        user: false,
      });
      expect(world.rowsFor(session)).toEqual({ admin: 1, user: 1 });
      expect(await world.probe(session)).toEqual({ admin: 200, user: 200 });
    }
    expect(await world.isCached(someoneElse)).toEqual({
      admin: true,
      user: true,
    });
  });
});

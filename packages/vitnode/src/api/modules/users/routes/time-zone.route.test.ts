// @vitest-environment node
import type { Context } from "hono";

import { describe, expect, it, vi } from "vitest";

import { core_users } from "@/database/users";
import {
  createSessionWorld,
  fakeSession,
  sessionCookies,
} from "@/tests/sessions";

import { updateMyTimeZoneRoute } from "./time-zone.route";

const LAPTOP = { id: 3, publicId: "laptop" };
const member = fakeSession(7, LAPTOP);

const setup = async () => {
  const world = await createSessionWorld({ sessions: [member] });
  const emit = vi.fn(async () => await Promise.resolve());
  world.app.use("*", async (c, next) => {
    c.set("events", { emit } as unknown as Context["var"]["events"]);
    await next();
  });
  world.app.openapi(updateMyTimeZoneRoute.route, updateMyTimeZoneRoute.handler);

  const save = async (timeZone: null | string, signedIn = true) =>
    await world.app.request("/me/time-zone", {
      body: JSON.stringify({ timeZone }),
      headers: {
        "content-type": "application/json",
        ...(signedIn ? { cookie: sessionCookies(member, "user") } : {}),
      },
      method: "PUT",
    });

  const storedTimeZone = () =>
    world.rows(core_users).find(row => row.id === member.userId)?.timeZone;

  return { ...world, emit, save, storedTimeZone };
};

describe("PUT /users/me/time-zone", () => {
  it("saves a known time zone on the member's account", async () => {
    const { emit, save, storedTimeZone } = await setup();

    const response = await save("Europe/Warsaw");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ timeZone: "Europe/Warsaw" });
    expect(storedTimeZone()).toBe("Europe/Warsaw");
    expect(emit).toHaveBeenCalledWith(
      "user.updated",
      expect.objectContaining({ userId: member.userId }),
    );
  });

  it("clears it with null so the language's time zone applies again", async () => {
    const { save, storedTimeZone } = await setup();
    await save("Europe/Warsaw");

    expect((await save(null)).status).toBe(200);
    expect(storedTimeZone()).toBeNull();
  });

  it("refuses a time zone that doesn't exist", async () => {
    const { save, storedTimeZone } = await setup();

    expect((await save("Mars/Olympus_Mons")).status).toBe(400);
    expect(storedTimeZone() ?? null).toBeNull();
  });

  it("refuses visitors who aren't signed in", async () => {
    const { save } = await setup();

    expect((await save("Europe/Warsaw", false)).status).toBe(401);
  });
});

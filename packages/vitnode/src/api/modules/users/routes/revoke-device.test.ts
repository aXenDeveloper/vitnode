// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  createSessionWorld,
  fakeSession,
  sessionCookies,
} from "@/tests/sessions";

import { revokeDeviceRoute } from "./revoke-device.route";

const LAPTOP = { id: 3, publicId: "laptop" };
const PHONE = { id: 4, publicId: "phone" };

const onLaptop = fakeSession(7, LAPTOP);
const onPhone = fakeSession(7, PHONE);
const someoneElseOnLaptop = fakeSession(8, LAPTOP);

const setup = async () => {
  const world = await createSessionWorld({
    sessions: [onLaptop, onPhone, someoneElseOnLaptop],
  });
  world.app.openapi(revokeDeviceRoute.route, revokeDeviceRoute.handler);

  for (const session of [onLaptop, onPhone, someoneElseOnLaptop]) {
    expect(await world.probe(session)).toEqual({ admin: 200, user: 200 });
  }

  const revokeLaptop = async () =>
    await world.app.request(`/devices/${LAPTOP.publicId}`, {
      headers: { cookie: sessionCookies(onPhone, "user") },
      method: "DELETE",
    });

  return { ...world, revokeLaptop };
};

describe("revoking a device", () => {
  it("ends the user session and the AdminCP session on it", async () => {
    const { revokeLaptop, rowsFor } = await setup();

    const response = await revokeLaptop();

    expect(response.status).toBe(200);
    expect(rowsFor(onLaptop)).toEqual({ admin: 0, user: 0 });
  });

  it("drops both cached sessions for that device", async () => {
    const { isCached, revokeLaptop } = await setup();
    expect(await isCached(onLaptop)).toEqual({ admin: true, user: true });

    await revokeLaptop();

    expect(await isCached(onLaptop)).toEqual({ admin: false, user: false });
  });

  it("rejects the old AdminCP cookie on the next request", async () => {
    const { probe, revokeLaptop } = await setup();

    await revokeLaptop();

    expect(await probe(onLaptop)).toEqual({ admin: 401, user: 401 });
  });

  it("leaves the user's other devices signed in", async () => {
    const { isCached, probe, revokeLaptop, rowsFor } = await setup();

    await revokeLaptop();

    expect(rowsFor(onPhone)).toEqual({ admin: 1, user: 1 });
    expect(await isCached(onPhone)).toEqual({ admin: true, user: true });
    expect(await probe(onPhone)).toEqual({ admin: 200, user: 200 });
  });

  it("leaves another user's sessions on the same device alone", async () => {
    const { probe, revokeLaptop, rowsFor } = await setup();

    await revokeLaptop();

    expect(rowsFor(someoneElseOnLaptop)).toEqual({ admin: 1, user: 1 });
    expect(await probe(someoneElseOnLaptop)).toEqual({
      admin: 200,
      user: 200,
    });
  });

  it("ends an AdminCP session on a device with no user session", async () => {
    const OFFICE = { id: 5, publicId: "office" };
    const adminOnlyOnOffice = fakeSession(7, OFFICE, ["admin"]);
    const { app, probe, rowsFor } = await createSessionWorld({
      sessions: [onPhone, adminOnlyOnOffice],
    });
    app.openapi(revokeDeviceRoute.route, revokeDeviceRoute.handler);
    expect(await probe(adminOnlyOnOffice)).toEqual({ admin: 200, user: 401 });

    const response = await app.request(`/devices/${OFFICE.publicId}`, {
      headers: { cookie: sessionCookies(onPhone, "user") },
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    expect(rowsFor(adminOnlyOnOffice)).toEqual({ admin: 0, user: 0 });
    expect(await probe(adminOnlyOnOffice)).toEqual({ admin: 401, user: 401 });
  });

  it("answers 404 for another user's device, as for an unknown one, and ends nothing", async () => {
    const TABLET = { id: 6, publicId: "tablet" };
    const someoneElseOnTablet = fakeSession(8, TABLET);
    const { app, probe, rowsFor } = await createSessionWorld({
      sessions: [onPhone, someoneElseOnTablet],
    });
    app.openapi(revokeDeviceRoute.route, revokeDeviceRoute.handler);
    const revoke = async (publicId: string) =>
      await app.request(`/devices/${publicId}`, {
        headers: { cookie: sessionCookies(onPhone, "user") },
        method: "DELETE",
      });

    const foreign = await revoke(TABLET.publicId);
    const unknown = await revoke("nobody-has-this");

    expect(foreign.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(await foreign.json()).toEqual(await unknown.json());
    expect(rowsFor(someoneElseOnTablet)).toEqual({ admin: 1, user: 1 });
    expect(await probe(someoneElseOnTablet)).toEqual({
      admin: 200,
      user: 200,
    });
  });
});

// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  createSessionWorld,
  fakeSession,
  sessionCookies,
} from "@/tests/sessions";

import { listDevicesRoute } from "./devices.route";

const PHONE = { id: 4, lastSeen: new Date("2026-09-30"), publicId: "phone" };
const OFFICE = { id: 5, lastSeen: new Date("2026-09-20"), publicId: "office" };
const LAPTOP = { id: 3, lastSeen: new Date("2026-09-10"), publicId: "laptop" };
const TABLET = { id: 6, lastSeen: new Date("2026-09-25"), publicId: "tablet" };

const onPhone = fakeSession(7, PHONE);
const adminOnlyOnOffice = fakeSession(7, OFFICE, ["admin"]);
const userOnlyOnLaptop = fakeSession(7, LAPTOP, ["user"]);
const someoneElseOnTablet = fakeSession(8, TABLET);

interface ListedDevice {
  isCurrent: boolean;
  publicId: string;
  sessionKinds: string[];
}

const listDevices = async () => {
  const { app } = await createSessionWorld({
    sessions: [
      onPhone,
      adminOnlyOnOffice,
      userOnlyOnLaptop,
      someoneElseOnTablet,
    ],
  });
  app.openapi(listDevicesRoute.route, listDevicesRoute.handler);

  const response = await app.request("/devices", {
    headers: { cookie: sessionCookies(onPhone, "user") },
  });
  expect(response.status).toBe(200);
  const { devices } = (await response.json()) as { devices: ListedDevice[] };

  return devices.map(({ isCurrent, publicId, sessionKinds }) => ({
    isCurrent,
    publicId,
    sessionKinds,
  }));
};

describe("listing devices", () => {
  it("includes a device that holds only an AdminCP session", async () => {
    expect(await listDevices()).toContainEqual({
      isCurrent: false,
      publicId: OFFICE.publicId,
      sessionKinds: ["admin"],
    });
  });

  it("names the session kinds on each device, newest first, and only the user's own", async () => {
    expect(await listDevices()).toEqual([
      {
        isCurrent: true,
        publicId: PHONE.publicId,
        sessionKinds: ["user", "admin"],
      },
      { isCurrent: false, publicId: OFFICE.publicId, sessionKinds: ["admin"] },
      { isCurrent: false, publicId: LAPTOP.publicId, sessionKinds: ["user"] },
    ]);
  });
});

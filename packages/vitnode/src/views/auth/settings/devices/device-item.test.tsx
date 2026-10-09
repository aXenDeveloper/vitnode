// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { describe, expect, it, vi } from "vitest";

import type { Device } from "./devices-query";

import { DevicesContent } from "./devices-content";

const ADMIN_BADGE = "core.auth.settings.devices.admin_session";

const device = (overrides: Partial<Device>): Device => ({
  browser: "Firefox",
  deviceType: "desktop",
  expiresAt: "2026-12-01T10:00:00.000Z",
  ipAddress: "203.0.113.7",
  isCurrent: false,
  lastSeen: "2026-09-30T10:00:00.000Z",
  os: "Linux",
  publicId: "office",
  sessionKinds: ["user"],
  ...overrides,
});

const renderDevices = (devices: Device[]) =>
  render(
    <IntlProvider locale="en" messages={{}} timeZone="UTC">
      <DevicesContent
        devices={devices}
        onRevoke={vi.fn(async () => Promise.resolve({ data: true as const }))}
      />
    </IntlProvider>,
  );

describe("DeviceItem", () => {
  it("marks a device holding an AdminCP session", () => {
    renderDevices([
      device({ publicId: "office", sessionKinds: ["admin"] }),
      device({ publicId: "laptop", sessionKinds: ["user"] }),
    ]);

    expect(screen.getAllByText(ADMIN_BADGE)).toHaveLength(1);
  });

  it("offers to sign out a device that holds only an AdminCP session", () => {
    renderDevices([device({ sessionKinds: ["admin"] })]);

    expect(
      screen.getByRole("button", {
        name: "core.auth.settings.devices.revoke.action",
      }),
    ).toBeTruthy();
  });

  it("shows no AdminCP mark on a device with only a user session", () => {
    renderDevices([device({ sessionKinds: ["user"] })]);

    expect(screen.queryByText(ADMIN_BADGE)).toBeNull();
  });
});

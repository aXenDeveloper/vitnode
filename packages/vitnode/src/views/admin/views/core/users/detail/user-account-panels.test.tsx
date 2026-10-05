import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SsoConnectionsApi } from "@/views/auth/settings/sso/sso-connections-query";
import type { NotificationPreferenceTypeView } from "@/views/notifications/notifications-query";

import { adminUserFixture } from "@/tests/admin-user";

import type { AdminUserDevice } from "./user-account-query";

import {
  adminUserDevicesQueryKey,
  adminUserNotificationsQueryKey,
  adminUserSsoQueryKey,
} from "./user-account-query";
import { UserConnectedAccountsCard } from "./user-connected-accounts";
import { UserDevicesCard } from "./user-devices";
import { UserNotificationsPanel } from "./user-notifications";
import { UserSecurityPanel } from "./user-security";

const ADMIN_ID = 1;
const USER_ID = 7;
const KEY = { adminUserId: ADMIN_ID, userId: USER_ID };

const user = adminUserFixture({ id: USER_ID, name: "Target" });

const device = (publicId: string, browser: string): AdminUserDevice => ({
  browser,
  deviceType: "desktop",
  expiresAt: "2026-12-01T00:00:00.000Z",
  ipAddress: "10.0.0.1",
  lastSeen: "2026-10-01T00:00:00.000Z",
  os: "macOS",
  publicId,
  sessionKinds: ["user"],
});

const sso = (
  hasPassword: boolean,
  signIn: Partial<SsoConnectionsApi["signIn"]> = {},
): SsoConnectionsApi => ({
  providers: [
    {
      available: true,
      connection: {
        accountLabel: "octocat",
        connectedAt: "2026-03-01T00:00:00.000Z",
        email: null,
        syncOnSignIn: false,
      },
      icon: null,
      id: "github",
      name: "GitHub",
      profileFields: ["avatar"],
    },
  ],
  signIn: {
    hasPassword,
    passkeys: 0,
    passkeysEnabled: true,
    passwordEnabled: true,
    ...signIn,
  },
  sources: { avatar: null, firstName: null, lastName: null },
});

const notificationType: NotificationPreferenceTypeView = {
  category: "account",
  categoryLabel: "Account",
  defaultEmail: "immediate",
  description: null,
  emailModes: ["none", "immediate", "daily", "weekly"],
  id: "core.example",
  inAppAvailable: true,
  label: "Example type",
  locked: false,
  mandatory: false,
  pluginId: "@vitnode/core",
  pushAvailable: false,
  value: { email: "immediate", inApp: true, push: false },
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200,
  });

const mount = (ui: React.ReactNode, seed: (client: QueryClient) => void) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  seed(queryClient);

  render(
    <IntlProvider locale="en" messages={{}} timeZone="UTC">
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </IntlProvider>,
  );
};

const fetchMock = vi.fn<typeof fetch>();

const requestOf = (index: number) => {
  const [input, init] = fetchMock.mock.calls[index] ?? [];

  return {
    body:
      typeof init?.body === "string"
        ? (JSON.parse(init.body) as unknown)
        : undefined,
    method: init?.method,
    url:
      input instanceof Request
        ? input.url
        : input instanceof URL
          ? input.href
          : (input ?? ""),
  };
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      addEventListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UserDevicesCard", () => {
  const devices = [
    device("a1", "Chrome"),
    device("b2", "Safari"),
    device("c3", "Firefox"),
    device("d4", "Edge"),
    device("e5", "Opera"),
  ];

  it("lists the first three devices until all are revealed", async () => {
    mount(
      <UserDevicesCard adminUserId={ADMIN_ID} canEdit user={user} />,
      client => {
        client.setQueryData(adminUserDevicesQueryKey(KEY), devices);
      },
    );

    expect(
      await screen.findAllByText("admin.user.show.devices.deviceName"),
    ).toHaveLength(3);

    fireEvent.click(
      screen.getByRole("button", { name: "admin.user.show.devices.showAll" }),
    );

    expect(
      screen.getAllByText("admin.user.show.devices.deviceName"),
    ).toHaveLength(5);
  });

  it("signs one device out after the confirmation", async () => {
    fetchMock.mockImplementation(
      async (_input, init) =>
        await Promise.resolve(
          init?.method === "DELETE"
            ? json({ ok: true })
            : json({ devices: devices.slice(1) }),
        ),
    );
    mount(
      <UserDevicesCard adminUserId={ADMIN_ID} canEdit user={user} />,
      client => {
        client.setQueryData(adminUserDevicesQueryKey(KEY), devices);
      },
    );

    const [first] = await screen.findAllByRole("button", {
      name: "admin.user.show.devices.signOutLabel",
    });
    if (!first) throw new Error("No sign-out button");
    fireEvent.click(first);
    fireEvent.click(
      await screen.findByText("admin.user.show.devices.signOutSubmit"),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const request = requestOf(0);
    expect(request.method).toBe("DELETE");
    expect(request.url).toContain(`/${USER_ID}/devices/a1`);
  });

  it("has no sign-out controls without edit permission", async () => {
    mount(
      <UserDevicesCard adminUserId={ADMIN_ID} canEdit={false} user={user} />,
      client => {
        client.setQueryData(adminUserDevicesQueryKey(KEY), devices);
      },
    );

    await screen.findAllByText("admin.user.show.devices.deviceName");
    expect(screen.queryByText("admin.user.show.devices.signOutAll")).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "admin.user.show.devices.signOutLabel",
      }),
    ).toBeNull();
  });
});

describe("UserConnectedAccountsCard", () => {
  const disconnect = async () =>
    screen.findByRole("button", { name: "admin.user.show.sso.disconnect" });

  it("blocks disconnecting the only way to sign in", async () => {
    mount(
      <UserConnectedAccountsCard adminUserId={ADMIN_ID} canEdit user={user} />,
      client => {
        client.setQueryData(adminUserSsoQueryKey(KEY), sso(false));
      },
    );

    expect((await disconnect()).hasAttribute("disabled")).toBe(true);
  });

  it("disconnects an account when the member still has a password", async () => {
    fetchMock.mockImplementation(
      async (_input, init) =>
        await Promise.resolve(
          init?.method === "DELETE" ? json({ ok: true }) : json(sso(true)),
        ),
    );
    mount(
      <UserConnectedAccountsCard adminUserId={ADMIN_ID} canEdit user={user} />,
      client => {
        client.setQueryData(adminUserSsoQueryKey(KEY), sso(true));
      },
    );

    const button = await disconnect();
    expect(button.hasAttribute("disabled")).toBe(false);
    fireEvent.click(button);
    fireEvent.click(
      await screen.findByText("admin.user.show.sso.disconnectSubmit"),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const request = requestOf(0);
    expect(request.method).toBe("DELETE");
    expect(request.url).toContain(`/${USER_ID}/sso/github`);
  });
});

describe("UserSecurityPanel", () => {
  const panel = (
    <UserSecurityPanel adminUserId={ADMIN_ID} canEdit user={user} />
  );

  it("reports a failed sign-in lookup instead of loading passkeys forever", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    mount(panel, () => {});

    expect(
      await screen.findByText("admin.user.show.security.passkeysLoadError"),
    ).not.toBeNull();
    expect(
      screen.getByText("admin.user.show.security.passwordLoadError"),
    ).not.toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "admin.user.show.security.passwordAdd",
      }),
    ).toBeNull();
  });

  it("offers no password reset while password sign-in is turned off", async () => {
    mount(panel, client => {
      client.setQueryData(
        adminUserSsoQueryKey(KEY),
        sso(false, { passkeysEnabled: false, passwordEnabled: false }),
      );
    });

    expect(
      await screen.findByText("admin.user.show.security.passwordDisabled"),
    ).not.toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "admin.user.show.security.passwordAdd",
      }),
    ).toBeNull();
  });

  it("offers a password reset while password sign-in is on", async () => {
    mount(panel, client => {
      client.setQueryData(
        adminUserSsoQueryKey(KEY),
        sso(false, { passkeysEnabled: false }),
      );
    });

    expect(
      await screen.findByRole("button", {
        name: "admin.user.show.security.passwordAdd",
      }),
    ).not.toBeNull();
  });
});

describe("UserNotificationsPanel", () => {
  it("saves a channel change for the member", async () => {
    fetchMock.mockImplementation(
      async () =>
        await Promise.resolve(
          json({
            types: [
              {
                ...notificationType,
                value: { ...notificationType.value, inApp: false },
              },
            ],
          }),
        ),
    );
    mount(
      <UserNotificationsPanel adminUserId={ADMIN_ID} canEdit user={user} />,
      client => {
        client.setQueryData(adminUserNotificationsQueryKey(KEY), [
          notificationType,
        ]);
      },
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Example type" }),
    );
    const [inApp] = screen.getAllByRole("switch");
    if (!inApp) throw new Error("No in-app switch");
    fireEvent.click(inApp);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const request = requestOf(0);
    expect(request.method).toBe("PUT");
    expect(request.url).toContain(`/${USER_ID}/notification-preferences`);
    expect(request.body).toEqual({
      types: { "core.example": { inApp: false } },
    });
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { Passkey } from "./passkeys-query";

import { PasskeysContent } from "./passkeys-content";

const label = (key: string) => `core.auth.settings.passkeys.${key}`;

const synced: Passkey = {
  backedUp: true,
  createdAt: "2026-09-01T10:00:00.000Z",
  deviceType: "multiDevice",
  id: 4,
  lastUsedAt: null,
  name: "iCloud Keychain",
  transports: ["internal", "hybrid"],
};

const securityKey: Passkey = {
  backedUp: false,
  createdAt: "2026-09-10T10:00:00.000Z",
  deviceType: "singleDevice",
  id: 7,
  lastUsedAt: "2026-09-20T10:00:00.000Z",
  name: "YubiKey",
  transports: ["usb"],
};

const renderContent = ({ passkeys = [synced, securityKey] } = {}) => {
  const handlers = {
    onAdd: vi.fn(async () =>
      Promise.resolve({ failure: "cancelled" as const, ok: false as const }),
    ),
    onDelete: vi.fn(async () => Promise.resolve({ ok: true as const })),
    onRename: vi.fn(async () => Promise.resolve({ ok: true as const })),
  };

  render(
    <IntlProvider locale="en" messages={{}} timeZone="UTC">
      <PasskeysContent isPasswordEnabled passkeys={passkeys} {...handlers} />
    </IntlProvider>,
  );

  return handlers;
};

const finePointer = (media: string): MediaQueryList => ({
  addEventListener: () => undefined,
  addListener: () => undefined,
  dispatchEvent: () => false,
  matches: false,
  media,
  onchange: null,
  removeEventListener: () => undefined,
  removeListener: () => undefined,
});

beforeAll(async () => {
  await import("./passkey-name-editor");
});

beforeEach(() => {
  vi.stubGlobal("matchMedia", finePointer);
  vi.stubGlobal("PublicKeyCredential", function PublicKeyCredential() {
    return undefined;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PasskeysContent", () => {
  it("lists every passkey with where it lives and whether it was used", () => {
    renderContent();

    expect(screen.getByText("iCloud Keychain")).toBeDefined();
    expect(screen.getByText("YubiKey")).toBeDefined();
    expect(screen.getByText(label("synced"))).toBeDefined();
    expect(screen.getByText(label("device_bound"))).toBeDefined();
    expect(screen.getByText(label("never_used"))).toBeDefined();
  });

  it("says so when there are no passkeys yet", () => {
    renderContent({ passkeys: [] });

    expect(screen.getByText(label("empty"))).toBeDefined();
  });

  it("starts the browser ceremony from the add button", async () => {
    const { onAdd } = renderContent();

    fireEvent.click(screen.getByRole("button", { name: label("add") }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledOnce();
    });
  });

  it("disables adding in a browser without WebAuthn and explains why", () => {
    vi.stubGlobal("PublicKeyCredential", undefined);
    renderContent();

    const add = screen.getByRole<HTMLButtonElement>("button", {
      name: label("add"),
    });
    expect(add.disabled).toBe(true);
    expect(screen.getByText(label("unsupported_hint"))).toBeDefined();
  });

  it("removes a passkey only after the confirmation", async () => {
    const { onDelete } = renderContent();

    const [removeFirst] = screen.getAllByRole("button", {
      name: label("delete.action"),
    });
    if (!removeFirst) throw new Error("no remove button rendered");
    fireEvent.click(removeFirst);

    expect(await screen.findByText(label("delete.title"))).toBeDefined();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(
      await screen.findByRole("button", { name: label("delete.confirm") }),
    );

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith({ id: synced.id });
    });
  });

  it("swaps a row for the name editor when renaming", async () => {
    renderContent();

    const [renameFirst] = screen.getAllByRole("button", {
      name: label("rename.action"),
    });
    if (!renameFirst) throw new Error("no rename button rendered");
    fireEvent.click(renameFirst);

    expect(
      await screen.findByRole("textbox", { name: label("rename.label") }),
    ).toBeDefined();
    expect(screen.queryByText("iCloud Keychain")).toBeNull();
  });
});

// @vitest-environment jsdom
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { toast } from "sonner";
import { IntlProvider } from "use-intl";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { SsoConnectionsApi } from "./sso-connections-query";

import { ImportPreviewDialog } from "./import-preview-dialog";
import { SsoConnectionsContent } from "./sso-connections-content";

const label = (key: string) => `core.auth.settings.sso.${key}`;

const DATA: SsoConnectionsApi = {
  providers: [
    {
      available: true,
      connection: {
        accountLabel: "alice.personal@gmail.test",
        connectedAt: "2026-09-01T10:00:00.000Z",
        email: "alice.personal@gmail.test",
        syncOnSignIn: false,
      },
      icon: null,
      id: "google",
      name: "Google",
      profileFields: ["avatar", "firstName", "lastName"],
    },
    {
      available: true,
      connection: {
        accountLabel: null,
        connectedAt: "2026-09-02T10:00:00.000Z",
        email: null,
        syncOnSignIn: true,
      },
      icon: null,
      id: "discord",
      name: "Discord",
      profileFields: ["avatar"],
    },
    {
      available: true,
      connection: null,
      icon: null,
      id: "facebook",
      name: "Facebook",
      profileFields: ["avatar", "firstName", "lastName"],
    },
    {
      available: true,
      connection: {
        accountLabel: "octocat",
        connectedAt: "2026-09-03T10:00:00.000Z",
        email: null,
        syncOnSignIn: false,
      },
      icon: null,
      id: "github",
      name: "GitHub",
      profileFields: [],
    },
  ],
  signIn: {
    hasPassword: false,
    passkeys: 0,
    passkeysEnabled: true,
    passwordEnabled: true,
  },
  sources: { avatar: "discord", firstName: null, lastName: null },
};

const PROFILE = {
  avatarUrl: null,
  firstName: "Aleksandra-Maria",
  lastName: null,
};

const renderContent = (data: SsoConnectionsApi = DATA) => {
  const handlers = {
    onDisconnect: vi.fn(async () => Promise.resolve({ ok: true as const })),
    onSavePreferences: vi.fn(async () =>
      Promise.resolve({ ok: true as const }),
    ),
    onStart: vi.fn(async () =>
      Promise.resolve({ ok: true as const, url: "https://provider.test" }),
    ),
  };

  render(
    <IntlProvider locale="en" messages={{}} timeZone="UTC">
      <SsoConnectionsContent data={data} profile={PROFILE} {...handlers} />
    </IntlProvider>,
  );

  return handlers;
};

const accountRow = (name: string) => {
  const row = screen
    .getAllByText(name)
    .map(element => element.closest("li"))
    .find(item => item?.querySelector("button"));
  if (!row) throw new Error(`No account row for ${name}`);

  return within(row);
};

beforeAll(async () => {
  await import("@/components/confirm-action/content");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SsoConnectionsContent accounts", () => {
  it("shows each account with what it is connected to and since when", () => {
    renderContent();

    const google = accountRow("Google");
    expect(google.getByText("alice.personal@gmail.test")).toBeDefined();
    expect(
      google.getByText(label("connected_at"), { exact: false }),
    ).toBeDefined();
    expect(
      accountRow("Discord").getByText(label("account_unknown")),
    ).toBeDefined();
    expect(
      accountRow("Facebook").getByText(label("status.not_connected")),
    ).toBeDefined();
  });

  it("offers Connect only where nothing is connected, and Import only where there is something to import", () => {
    renderContent();

    expect(
      accountRow("Facebook").getByRole("button", {
        name: label("connect.aria"),
      }),
    ).toBeDefined();
    expect(
      accountRow("Google").queryByRole("button", {
        name: label("connect.aria"),
      }),
    ).toBeNull();
    expect(
      accountRow("Google").getByRole("button", { name: label("import.aria") }),
    ).toBeDefined();
    expect(
      accountRow("GitHub").queryByRole("button", {
        name: label("import.aria"),
      }),
    ).toBeNull();
  });

  it("starts the linking round trip from Connect", async () => {
    const { onStart } = renderContent();

    fireEvent.click(
      accountRow("Facebook").getByRole("button", {
        name: label("connect.aria"),
      }),
    );

    await waitFor(() => {
      expect(onStart).toHaveBeenCalledWith({
        intent: "link",
        providerId: "facebook",
      });
    });
  });

  it("asks before disconnecting, and says the provider keeps its own authorization", async () => {
    const { onDisconnect } = renderContent();

    fireEvent.click(
      accountRow("Google").getByRole("button", {
        name: label("disconnect.action"),
      }),
    );

    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(label("disconnect.provider_note")),
    ).toBeDefined();
    expect(onDisconnect).not.toHaveBeenCalled();

    fireEvent.click(
      await within(dialog).findByRole("button", {
        name: label("disconnect.confirm"),
      }),
    );

    await waitFor(() => {
      expect(onDisconnect).toHaveBeenCalledWith({ providerId: "google" });
    });
  });

  it("explains how to add another way in when the last one would go", async () => {
    const error = vi.spyOn(toast, "error");
    const { onDisconnect } = renderContent();
    onDisconnect.mockResolvedValueOnce({
      failure: "last_sign_in_method",
      ok: false,
    } as never);

    fireEvent.click(
      accountRow("Google").getByRole("button", {
        name: label("disconnect.action"),
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: label("disconnect.confirm") }),
    );

    await waitFor(() => {
      expect(error).toHaveBeenCalledWith(
        label("errors.last_sign_in_method.title"),
        {
          description: [
            label("errors.last_sign_in_method.desc"),
            label("errors.last_sign_in_method.hint_password"),
            label("errors.last_sign_in_method.hint_passkey"),
            label("errors.last_sign_in_method.hint_connect_other"),
          ].join(" "),
        },
      );
    });
  });

  it("opens the import dialog for the chosen provider", async () => {
    renderContent();

    fireEvent.click(
      accountRow("Discord").getByRole("button", { name: label("import.aria") }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(label("import.title"))).toBeDefined();
  });
});

describe("SsoConnectionsContent profile fields", () => {
  it("shows each field's current value next to where it comes from", () => {
    renderContent();

    expect(screen.getByText("Aleksandra-Maria")).toBeDefined();
    expect(
      screen.getByLabelText<HTMLSelectElement>(label("fields.avatar")).value,
    ).toBe("discord");
    expect(
      screen.getByLabelText<HTMLSelectElement>(label("fields.firstName")).value,
    ).toBe("manual");
  });

  it("offers only connected accounts that can supply the field", () => {
    renderContent();

    const options = (field: string) =>
      Array.from(
        screen.getByLabelText<HTMLSelectElement>(label(`fields.${field}`))
          .options,
        option => option.value,
      );

    expect(options("avatar")).toEqual(["manual", "google", "discord"]);
    expect(options("firstName")).toEqual(["manual", "google"]);
  });

  it("leaves out fields no connected account can supply", () => {
    renderContent({
      ...DATA,
      providers: DATA.providers.filter(one => one.id !== "google"),
    });

    expect(screen.getByLabelText(label("fields.avatar"))).toBeDefined();
    expect(screen.queryByLabelText(label("fields.firstName"))).toBeNull();
    expect(screen.queryByLabelText(label("fields.lastName"))).toBeNull();
  });

  it("leaves out the whole group until an account can supply a field", () => {
    renderContent({
      ...DATA,
      providers: DATA.providers.map(one =>
        one.profileFields.length > 0 ? { ...one, connection: null } : one,
      ),
    });

    expect(screen.queryByText(label("groups.profile"))).toBeNull();
    expect(screen.queryByText(label("sync.manual_edit_note"))).toBeNull();
  });

  it("saves a new source as soon as it is picked", async () => {
    const success = vi.spyOn(toast, "success");
    const { onSavePreferences } = renderContent();

    fireEvent.change(screen.getByLabelText(label("fields.avatar")), {
      target: { value: "google" },
    });

    await waitFor(() => {
      expect(onSavePreferences).toHaveBeenCalledWith({
        sources: { avatar: "google" },
        sync: {},
      });
      expect(success).toHaveBeenCalledWith(label("source.saved_from"));
    });
  });

  it("puts a field back to manual", async () => {
    const { onSavePreferences } = renderContent();

    fireEvent.change(screen.getByLabelText(label("fields.avatar")), {
      target: { value: "manual" },
    });

    await waitFor(() => {
      expect(onSavePreferences).toHaveBeenCalledWith({
        sources: { avatar: null },
        sync: {},
      });
    });
  });

  it("explains that editing a field by hand makes it manual", () => {
    renderContent();

    expect(screen.getByText(label("sync.manual_edit_note"))).toBeDefined();
  });
});

describe("SsoConnectionsContent sync", () => {
  it("lists only accounts that a field follows, with those fields", () => {
    renderContent();

    const group = within(
      screen.getByText(label("groups.sync")).closest("div") as HTMLElement,
    );
    expect(group.getByText("Discord")).toBeDefined();
    expect(group.getByText(label("fields.avatar"))).toBeDefined();
    expect(group.queryByText("Google")).toBeNull();
  });

  it("leaves the group out until a field follows an account", () => {
    renderContent({
      ...DATA,
      sources: { avatar: null, firstName: null, lastName: null },
    });

    expect(screen.queryByText(label("groups.sync"))).toBeNull();
  });

  it("re-authenticates with the provider from Sync now", async () => {
    const { onStart } = renderContent();

    fireEvent.click(
      screen.getByRole("button", { name: label("sync.sync_now_aria") }),
    );

    await waitFor(() => {
      expect(onStart).toHaveBeenCalledWith({
        intent: "sync",
        providerId: "discord",
      });
    });
  });

  it("saves the sign-in switch right away", async () => {
    const { onSavePreferences } = renderContent();

    fireEvent.click(
      screen.getByRole("switch", { name: label("sync.on_sign_in") }),
    );

    await waitFor(() => {
      expect(onSavePreferences).toHaveBeenCalledWith({
        sources: {},
        sync: { discord: false },
      });
    });
  });
});

describe("ImportPreviewDialog", () => {
  const renderPreview = (
    preview: React.ComponentProps<typeof ImportPreviewDialog>["preview"],
  ) => {
    const onClose = vi.fn();

    render(
      <IntlProvider locale="en" messages={{}} timeZone="UTC">
        <ImportPreviewDialog
          currentAvatarUrl={null}
          onApply={vi.fn()}
          onClose={onClose}
          preview={preview}
          providerId="google"
          providers={DATA.providers}
        />
      </IntlProvider>,
    );

    return { onClose };
  };

  it("announces that the preview is loading", () => {
    renderPreview(undefined);

    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.getByText(label("preview.loading"))).toBeDefined();
  });

  it("explains an expired import and lets the member close it", () => {
    const { onClose } = renderPreview(null);

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(label("errors.preview_not_found.title")),
    ).toBeDefined();

    const footerClose = within(dialog)
      .getAllByRole("button", { name: "core.global.close" })
      .find(button => button.textContent === "core.global.close");
    if (!footerClose) throw new Error("No close button in the dialog footer");
    fireEvent.click(footerClose);

    expect(onClose).toHaveBeenCalled();
  });
});

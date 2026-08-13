import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ContentRowActionsMenu } from "./row-actions-menu";

/** The permissions the role under test holds, keyed the way the routes name them. */
let permissions: Record<string, boolean> = {};

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => {
    const t = (key: string) => `${namespace}.${key}`;
    t.rich = (key: string) => `${namespace}.${key}`;

    return t;
  },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("@/components/staff-permission/provider", () => ({
  useAdminStaffPermission: ({ permission }: { permission: string }) =>
    permissions[permission] ?? false,
}));

// The panel bodies fetch on mount and are beside the point here: what matters is
// which actions the menu offers, and that the panel it opens survives the menu
// closing underneath it.
vi.mock("./history/revision-history", () => ({
  RevisionHistory: () => <div>revision history</div>,
}));
vi.mock("./delivery/delivery-panel", () => ({
  DeliveryPanel: () => <div>delivery panel</div>,
}));
vi.mock("./schedule/schedule-panel", () => ({
  SchedulePanel: () => <div>schedule panel</div>,
}));
vi.mock("./translations/translation-manager", () => ({
  TranslationManager: () => <div>translation manager</div>,
}));
vi.mock("./mutation-api.server", () => ({
  createContentPreviewAction: async () => {
    await Promise.resolve();

    return { status: 503 };
  },
  deleteContentAction: async () => {
    await Promise.resolve();

    return {};
  },
}));

const renderMenu = (
  props: Partial<React.ComponentProps<typeof ContentRowActionsMenu>> = {},
) =>
  render(
    <ContentRowActionsMenu
      contentTypeId="test.post"
      currentVersion={4}
      defaultLocale="en"
      delivery
      editorial
      id={7}
      localized
      permissionModule="posts"
      pluginId="@vitnode/example"
      preview
      publication
      scheduling
      singular="Post"
      spec={{} as never}
      title="Hello world"
      version={4}
      {...props}
    />,
  );

const openMenu = () => {
  fireEvent.click(
    screen.getByRole("button", { name: "core.content.table.more_actions" }),
  );
};

const itemNames = () =>
  screen.getAllByRole("menuitem").map(item => item.textContent);

beforeEach(() => {
  permissions = { can_delete: true, can_publish: true, can_view: true };
});

describe("ContentRowActionsMenu", () => {
  it("keeps the row to one button, whatever the content type opted into", () => {
    // The point of the menu: six actions used to be six icons in a cell that also
    // holds publish and edit.
    renderMenu();

    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("lists every action by name, with delete last", () => {
    renderMenu();
    openMenu();

    // The bare action names, not the panel headings: a menu row says what it
    // does, and the record it does it to is named by the panel that opens.
    expect(itemNames()).toEqual([
      "core.content.actions.preview",
      "core.content.actions.schedule",
      "core.content.actions.history",
      "core.content.actions.translations",
      "core.content.actions.delivery",
      "core.content.actions.delete",
    ]);
  });

  it("leaves out what the content type has not opted into", () => {
    renderMenu({ delivery: false, localized: false, preview: false });
    openMenu();

    expect(itemNames()).toEqual([
      "core.content.actions.schedule",
      "core.content.actions.history",
      "core.content.actions.delete",
    ]);
  });

  it("offers delete alone for a plain content type", () => {
    // No capability actions at all, but the menu is still where delete lives.
    renderMenu({
      delivery: false,
      editorial: false,
      localized: false,
      preview: false,
      scheduling: false,
    });
    openMenu();

    expect(itemNames()).toEqual(["core.content.actions.delete"]);
  });

  it("renders nothing for a role allowed none of them", () => {
    permissions = {};
    const { container } = renderMenu();

    expect(container.innerHTML).toBe("");
  });

  it("hides delete from a role without can_delete, and keeps the rest", () => {
    permissions = { can_publish: true, can_view: true };
    renderMenu();
    openMenu();

    expect(itemNames()).not.toContain("core.content.actions.delete");
    expect(itemNames()).toContain("core.content.actions.history");
  });

  it("hides scheduling from a role without can_publish, and keeps the rest", () => {
    // Booking a publication is publishing, just later. Reading what changed, or
    // where the record lives, is covered by seeing the record at all.
    permissions = { can_view: true };
    renderMenu();
    openMenu();

    expect(itemNames()).not.toContain("core.content.actions.schedule");
    expect(itemNames()).toContain("core.content.actions.history");
  });

  it("offers only history to a role that may read an editorial-only type", () => {
    permissions = { can_view: true };
    renderMenu({ delivery: false, localized: false, preview: false });
    openMenu();

    expect(itemNames()).toEqual(["core.content.actions.history"]);
  });

  describe("opening a panel", () => {
    it("opens the dialog the item names, and keeps it after the menu is gone", async () => {
      renderMenu();
      openMenu();
      fireEvent.click(
        screen.getByRole("menuitem", { name: "core.content.actions.history" }),
      );

      // The item that opened it is unmounted with the menu, which is exactly why
      // the open state lives on the menu component rather than inside the panel.
      const dialog = await screen.findByRole("dialog", undefined, {
        timeout: 3000,
      });

      // The heading, not the menu label: "History" opens *History of this
      // Article*, which is where the record gets named.
      expect(dialog.textContent).toContain("core.content.history.title");
      expect(screen.queryByRole("menuitem")).toBeNull();
    });

    it("opens one panel at a time", async () => {
      renderMenu();
      openMenu();
      fireEvent.click(
        screen.getByRole("menuitem", { name: "core.content.actions.delivery" }),
      );

      await screen.findByRole("dialog", undefined, { timeout: 3000 });

      expect(screen.getAllByRole("dialog")).toHaveLength(1);
      expect(screen.queryByText("revision history")).toBeNull();
    });

    it("still asks before deleting, and names the record", async () => {
      renderMenu();
      openMenu();
      fireEvent.click(
        screen.getByRole("menuitem", { name: "core.content.actions.delete" }),
      );

      // An alert dialog, not a plain one: nothing is deleted by opening it.
      const dialog = await screen.findByRole("alertdialog", undefined, {
        timeout: 3000,
      });

      expect(dialog.textContent).toContain("core.content.delete.title");
    });
  });
});

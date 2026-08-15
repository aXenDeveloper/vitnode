import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
    // Delete drops the cached picker options of whatever it removed, so the menu
    // needs the client the AdminCP layout provides around every screen.
    <QueryClientProvider client={new QueryClient()}>
      <ContentRowActionsMenu
        contentTypeId="test.post"
        currentVersion={4}
        delivery
        editorial
        id={7}
        permissionModule="posts"
        pluginId="@vitnode/example"
        preview
        scheduling
        singular="Post"
        spec={{} as never}
        title="Hello world"
        version={4}
        {...props}
      />
    </QueryClientProvider>,
  );

const moreButton = () =>
  screen.queryByRole("button", { name: "core.content.table.more_actions" });

const inlineNames = () =>
  screen
    .getAllByRole("button")
    .map(button => button.getAttribute("aria-label"));

/** Opens the ⋯ menu, or leaves it open if it already is. */
const openMenu = () => {
  const more = moreButton();
  if (more && more.getAttribute("aria-expanded") !== "true") {
    fireEvent.click(more);
  }
};

const actionNames = () => {
  if (!moreButton()) return inlineNames();

  openMenu();

  return screen.getAllByRole("menuitem").map(item => item.textContent);
};

beforeEach(() => {
  permissions = { can_delete: true, can_publish: true, can_view: true };
});

describe("ContentRowActionsMenu", () => {
  it("keeps the row to one button once there are too many actions to show", () => {
    renderMenu();

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(moreButton()).toBeTruthy();
  });

  describe("below the inline threshold", () => {
    const threeActions = { delivery: false, preview: false } as const;

    it("shows the actions as buttons rather than hiding them behind a menu", () => {
      renderMenu(threeActions);

      expect(moreButton()).toBeNull();
      expect(inlineNames()).toEqual([
        "core.content.actions.schedule",
        "core.content.actions.history",
        "core.content.actions.delete",
      ]);
    });

    it("collapses into the menu as soon as a fourth action appears", () => {
      renderMenu({ preview: false });

      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(moreButton()).toBeTruthy();
    });

    it("gives a role with delete alone the delete button itself", () => {
      permissions = { can_delete: true, can_view: true };
      renderMenu({ delivery: false, editorial: false, preview: false });

      const [button] = screen.getAllByRole("button");

      expect(button.getAttribute("aria-label")).toBe(
        "core.content.actions.delete",
      );
    });

    it("opens the same panel a menu item would have", async () => {
      renderMenu(threeActions);
      fireEvent.click(
        screen.getByRole("button", { name: "core.content.actions.delete" }),
      );

      const dialog = await screen.findByRole("alertdialog", undefined, {
        timeout: 3000,
      });

      expect(dialog.textContent).toContain("core.content.delete.title");
    });
  });

  it("lists every action by name, with delete last", () => {
    renderMenu();

    expect(actionNames()).toEqual([
      "core.content.actions.preview",
      "core.content.actions.schedule",
      "core.content.actions.history",
      "core.content.actions.delivery",
      "core.content.actions.delete",
    ]);
  });

  it("leaves out what the content type has not opted into", () => {
    renderMenu({ delivery: false, preview: false });

    expect(actionNames()).toEqual([
      "core.content.actions.schedule",
      "core.content.actions.history",
      "core.content.actions.delete",
    ]);
  });

  it("offers delete alone for a plain content type", () => {
    renderMenu({
      delivery: false,
      editorial: false,
      preview: false,
      scheduling: false,
    });

    expect(actionNames()).toEqual(["core.content.actions.delete"]);
  });

  it("renders nothing for a role allowed none of them", () => {
    permissions = {};
    const { container } = renderMenu();

    expect(container.innerHTML).toBe("");
  });

  it("hides delete from a role without can_delete, and keeps the rest", () => {
    permissions = { can_publish: true, can_view: true };
    renderMenu();

    expect(actionNames()).not.toContain("core.content.actions.delete");
    expect(actionNames()).toContain("core.content.actions.history");
  });

  it("hides scheduling from a role without can_publish, and keeps the rest", () => {
    permissions = { can_view: true };
    renderMenu();

    expect(actionNames()).not.toContain("core.content.actions.schedule");
    expect(actionNames()).toContain("core.content.actions.history");
  });

  it("offers only history to a role that may read an editorial-only type", () => {
    permissions = { can_view: true };
    renderMenu({ delivery: false, preview: false });

    expect(actionNames()).toEqual(["core.content.actions.history"]);
  });

  describe("opening a panel", () => {
    it("opens the dialog the item names, and keeps it after the menu is gone", async () => {
      renderMenu();
      openMenu();
      fireEvent.click(
        screen.getByRole("menuitem", { name: "core.content.actions.history" }),
      );

      const dialog = await screen.findByRole("dialog", undefined, {
        timeout: 3000,
      });

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

      const dialog = await screen.findByRole("alertdialog", undefined, {
        timeout: 3000,
      });

      expect(dialog.textContent).toContain("core.content.delete.title");
    });
  });
});

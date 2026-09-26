import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { NavigationPreset } from "../../../../../lib/navigation";
import type { AdminNavigationItem } from "./navigation-query";

import { AdminStaffPermissionProvider } from "../../../../../components/staff-permission/provider";
import {
  NavigationAdminListContent,
  usedNavigationPresetKeys,
} from "./navigation-list-content";

const at = new Date("2026-09-20T10:00:00Z");

const items: AdminNavigationItem[] = [
  {
    createdAt: at,
    description: [],
    href: null,
    icon: null,
    id: 1,
    isOpenInNewTab: false,
    kind: "preset",
    parentId: null,
    pluginId: "@vitnode/core",
    position: 0,
    preset: {
      href: "/discover",
      icon: "icon:compass",
      id: "discover",
      isOpenInNewTab: false,
      pluginId: "@vitnode/core",
    },
    presetId: "discover",
    title: [{ languageCode: "en", value: "Explore" }],
    updatedAt: at,
  },
  {
    createdAt: at,
    description: [{ languageCode: "en", value: "Read the guides" }],
    href: "https://vitnode.com/docs",
    icon: "icon:book-open",
    id: 2,
    isOpenInNewTab: true,
    kind: "custom",
    parentId: 1,
    pluginId: null,
    position: 0,
    preset: null,
    presetId: null,
    title: [{ languageCode: "en", value: "Docs" }],
    updatedAt: at,
  },
  {
    createdAt: at,
    description: [],
    href: "/blog",
    icon: null,
    id: 3,
    isOpenInNewTab: false,
    kind: "custom",
    parentId: null,
    pluginId: null,
    position: 1,
    preset: null,
    presetId: null,
    title: [{ languageCode: "en", value: "Blog" }],
    updatedAt: at,
  },
];

const presets: NavigationPreset[] = [
  {
    href: "/discover",
    icon: "icon:compass",
    id: "discover",
    isOpenInNewTab: false,
    pluginId: "@vitnode/core",
  },
  {
    href: "/search",
    icon: "icon:search",
    id: "search",
    isOpenInNewTab: false,
    pluginId: "@vitnode/core",
  },
];

const renderList = (
  overrides: Partial<Parameters<typeof NavigationAdminListContent>[0]> = {},
  permissions = { permissions: [], root: true },
) => {
  const props = {
    items,
    onDelete: vi.fn(async () => Promise.resolve({ data: true })),
    onReorder: vi.fn(async () => Promise.resolve({ data: true })),
    onSave: vi.fn(async () => Promise.resolve({ data: true })),
    presets,
    ...overrides,
  };

  render(
    <AdminStaffPermissionProvider value={permissions}>
      <NavigationAdminListContent {...props} />
    </AdminStaffPermissionProvider>,
  );

  return props;
};

const openRowMenu = async (index: number) => {
  const trigger = screen.getAllByRole("button", {
    name: "admin.navigation.list.actions",
  })[index];
  fireEvent.click(trigger);

  return await screen.findByRole("menu");
};

describe("NavigationAdminListContent", () => {
  it("lists every item with its resolved title and destination", () => {
    renderList();

    expect(screen.getByText("Explore")).toBeTruthy();
    expect(screen.getByText("Docs")).toBeTruthy();
    expect(screen.getByText("/discover")).toBeTruthy();
    expect(screen.getByText("https://vitnode.com/docs")).toBeTruthy();
  });

  it("draws a nested item one level in, right under its parent", () => {
    renderList();

    const rows = [...document.querySelectorAll("[data-depth]")];

    expect(
      rows.map(row => [
        row.querySelector("[data-testid]")?.getAttribute("data-testid"),
        row.getAttribute("data-depth"),
      ]),
    ).toEqual([
      ["navigation-item-1", "0"],
      ["navigation-item-2", "1"],
      ["navigation-item-3", "0"],
    ]);
  });

  it("names where each item comes from", () => {
    renderList();

    expect(screen.getAllByText("admin.navigation.list.custom")).toHaveLength(2);
    expect(screen.getByText("@vitnode/core")).toBeTruthy();
  });

  it("counts what sits in the header and what sits in dropdowns", () => {
    renderList();

    expect(screen.getByText("admin.navigation.list.summary")).toBeTruthy();
  });

  it("gives every item a drag handle an editor can grab", () => {
    renderList();

    expect(
      screen.getAllByRole("button", {
        name: "admin.navigation.list.dragHandle",
      }),
    ).toHaveLength(3);
  });

  it("shows the empty state when the menu has nothing in it", () => {
    renderList({ items: [] });

    expect(
      screen.getByText("admin.navigation.list.noResults.title"),
    ).toBeTruthy();
  });

  it("folds a parent's dropdown away and brings it back", () => {
    renderList();

    fireEvent.click(
      screen.getByRole("button", {
        name: "admin.navigation.list.hideChildren",
      }),
    );

    expect(screen.queryByText("Docs")).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "admin.navigation.list.showChildren",
      }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "admin.navigation.list.expandAll" }),
    );

    expect(screen.getByText("Docs")).toBeTruthy();
  });

  it("lifts a child to the top level from its menu", async () => {
    const props = renderList();

    const menu = await openRowMenu(1);
    fireEvent.click(
      within(menu).getByRole("menuitem", {
        name: "admin.navigation.list.moveToTop",
      }),
    );

    await waitFor(() => {
      expect(props.onReorder).toHaveBeenCalledWith({
        items: [
          { children: [], id: 1 },
          { children: [], id: 2 },
          { children: [], id: 3 },
        ],
      });
    });
  });

  it("moves a top-level item up past its neighbour from its menu", async () => {
    const props = renderList();

    const menu = await openRowMenu(2);
    fireEvent.click(
      within(menu).getByRole("menuitem", {
        name: "admin.navigation.list.moveUp",
      }),
    );

    await waitFor(() => {
      expect(props.onReorder).toHaveBeenCalledWith({
        items: [
          { children: [], id: 3 },
          { children: [2], id: 1 },
        ],
      });
    });
  });

  it("keeps the drag handles usable while a new order saves", async () => {
    renderList({
      onReorder: vi.fn(
        async () =>
          new Promise<{ data: true }>(() => {
            return undefined;
          }),
      ),
    });

    const menu = await openRowMenu(2);
    fireEvent.click(
      within(menu).getByRole("menuitem", {
        name: "admin.navigation.list.moveUp",
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("Blog")).toBeTruthy();
    });

    for (const handle of screen.getAllByRole("button", {
      name: "admin.navigation.list.dragHandle",
    })) {
      expect((handle as HTMLButtonElement).disabled).toBe(false);
    }
  });

  it("asks before removing and then deletes that item", async () => {
    const props = renderList();

    const menu = await openRowMenu(1);
    fireEvent.click(
      within(menu).getByRole("menuitem", {
        name: "admin.navigation.list.delete",
      }),
    );

    const confirm = await screen.findByRole("button", {
      name: "admin.navigation.delete.confirm",
    });
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(props.onDelete).toHaveBeenCalledWith(2);
    });
  });

  it("warns that a parent's children move up when it is removed", async () => {
    renderList();

    const menu = await openRowMenu(0);
    fireEvent.click(
      within(menu).getByRole("menuitem", {
        name: "admin.navigation.list.delete",
      }),
    );

    expect(
      await screen.findByText("admin.navigation.delete.descWithChildren"),
    ).toBeTruthy();
  });

  it("opens the add dialog for a parent, offering only unused pages", async () => {
    renderList();

    const menu = await openRowMenu(0);
    fireEvent.click(
      within(menu).getByRole("menuitem", {
        name: "admin.navigation.list.addChild",
      }),
    );

    const dialog = await screen.findByRole("dialog");

    expect(
      within(dialog).getByText("admin.navigation.create.childTitle"),
    ).toBeTruthy();
    expect(within(dialog).getByText("search")).toBeTruthy();
    expect(within(dialog).queryByText("discover")).toBeNull();
    expect(
      within(dialog).getByText("admin.navigation.form.kind.custom"),
    ).toBeTruthy();
  });

  it("steps back from the details to the choice of page", async () => {
    renderList();

    const menu = await openRowMenu(0);
    fireEvent.click(
      within(menu).getByRole("menuitem", {
        name: "admin.navigation.list.addChild",
      }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByText("admin.navigation.form.kind.custom"),
    );

    fireEvent.click(
      await within(dialog).findByRole("button", {
        name: "admin.navigation.create.back",
      }),
    );

    expect(
      await within(dialog).findByText("admin.navigation.create.presets"),
    ).toBeTruthy();
  });

  it("opens the editor for an item when its row is clicked", async () => {
    renderList();

    fireEvent.click(screen.getByText("Blog"));

    expect(await screen.findByText("admin.navigation.edit.title")).toBeTruthy();
  });

  it("opens the editor for a prebuilt page with its locked page shown", async () => {
    renderList();

    fireEvent.click(screen.getByText("Explore"));

    expect(
      await screen.findByText("admin.navigation.form.presetLocked"),
    ).toBeTruthy();
  });

  it("hides every action and handle from an admin who may only look", () => {
    renderList({}, { permissions: [], root: false });

    expect(
      screen.queryByRole("button", {
        name: "admin.navigation.list.dragHandle",
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "admin.navigation.list.actions" }),
    ).toBeNull();
  });
});

describe("usedNavigationPresetKeys", () => {
  it("names the presets already in the menu, minus the one being edited", () => {
    expect(usedNavigationPresetKeys(items)).toEqual([
      "@vitnode/core::discover",
    ]);
    expect(usedNavigationPresetKeys(items, 1)).toEqual([]);
  });
});

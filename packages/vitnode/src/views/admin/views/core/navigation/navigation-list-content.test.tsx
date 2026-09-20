import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AdminNavigationItem } from "./navigation-query";

import { AdminStaffPermissionProvider } from "../../../../../components/staff-permission/provider";
import {
  NavigationAdminListContent,
  usedNavigationPresetKeys,
} from "./navigation-list-content";

vi.mock("use-intl", () => ({
  useLocale: () => "en",
  useTranslations: (namespace?: string) => {
    const t = (key: string) => (namespace ? `${namespace}.${key}` : key);
    t.has = () => false;

    return t;
  },
}));

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

const renderList = (
  overrides: Partial<Parameters<typeof NavigationAdminListContent>[0]> = {},
  permissions = { permissions: [], root: true },
) => {
  const props = {
    items,
    onDelete: vi.fn(async () => Promise.resolve({ data: true })),
    onReorder: vi.fn(async () => Promise.resolve({ data: true })),
    onSave: vi.fn(async () => Promise.resolve({ data: true })),
    presets: [],
    ...overrides,
  };

  render(
    <AdminStaffPermissionProvider value={permissions}>
      <NavigationAdminListContent {...props} />
    </AdminStaffPermissionProvider>,
  );

  return props;
};

describe("NavigationAdminListContent", () => {
  it("lists every item with its resolved title and destination", () => {
    renderList();

    expect(screen.getByText("Explore")).toBeTruthy();
    expect(screen.getByText("Docs")).toBeTruthy();
    expect(screen.getByText("Read the guides")).toBeTruthy();
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

  it("badges a custom link and leaves a prebuilt page unlabelled", () => {
    renderList();

    expect(screen.getAllByText("admin.navigation.list.custom")).toHaveLength(2);
    expect(screen.queryByText("admin.navigation.list.prebuilt")).toBeNull();
  });

  it("gives every item a drag handle an editor can grab", () => {
    renderList();

    expect(
      screen.getAllByRole("button", {
        name: /admin\.navigation\.list\.dragHandle/,
      }),
    ).toHaveLength(3);
  });

  it("shows the empty state when the menu has nothing in it", () => {
    renderList({ items: [] });

    expect(
      screen.getByText("admin.navigation.list.noResults.title"),
    ).toBeTruthy();
  });

  it("asks before removing and then deletes that item", async () => {
    const props = renderList();

    const [, removeDocs] = screen.getAllByRole("button", {
      name: "admin.navigation.delete.title",
    });
    fireEvent.click(removeDocs);

    const confirm = await screen.findByRole("button", {
      name: "admin.navigation.delete.confirm",
    });
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(props.onDelete).toHaveBeenCalledWith(2);
    });
  });

  it("hides every action and handle from an admin who may only look", () => {
    renderList({}, { permissions: [], root: false });

    expect(
      screen.queryByRole("button", {
        name: /admin\.navigation\.list\.dragHandle/,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "admin.navigation.delete.title" }),
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

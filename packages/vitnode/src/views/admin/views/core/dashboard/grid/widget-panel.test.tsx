import { DndContext } from "@dnd-kit/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";

import type { DashboardWidgetOption } from "../widgets/types";

import { WidgetPanel } from "./widget-panel";

// SidebarProvider reads `useIsMobile`, and jsdom ships no matchMedia.
beforeAll(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}));

const option = (
  id: string,
  overrides: Partial<DashboardWidgetOption> = {},
): DashboardWidgetOption => ({
  id,
  title: `Title ${id}`,
  category: { id: "@vitnode/core", title: "Core" },
  minSpan: 1,
  defaultSpan: 1,
  defaultRows: 1,
  ...overrides,
});

const search = () =>
  screen.getByPlaceholderText("admin.dashboard.widgets.panel.search");

const renderPanel = (
  widgets: DashboardWidgetOption[],
  {
    actions,
    isOpen = true,
  }: { actions?: React.ReactNode; isOpen?: boolean } = {},
) => {
  const view = render(
    <SidebarProvider>
      <DndContext>
        <WidgetPanel actions={actions} isOpen={isOpen} widgets={widgets} />
      </DndContext>
    </SidebarProvider>,
  );

  return (next: boolean) =>
    view.rerender(
      <SidebarProvider>
        <DndContext>
          <WidgetPanel actions={actions} isOpen={next} widgets={widgets} />
        </DndContext>
      </SidebarProvider>,
    );
};

describe("WidgetPanel", () => {
  it("lists every available widget", () => {
    renderPanel([option("notes"), option("stats")]);

    expect(screen.getByText("Title notes")).toBeDefined();
    expect(screen.getByText("Title stats")).toBeDefined();
  });

  it("shows each widget's description", () => {
    renderPanel([
      option("notes", { desc: "A private scratchpad." }),
      option("stats", { desc: "Posts at a glance." }),
    ]);

    expect(screen.getByText("A private scratchpad.")).toBeDefined();
    expect(screen.getByText("Posts at a glance.")).toBeDefined();
  });

  it("renders a widget that has no description", () => {
    renderPanel([option("bare")]);

    expect(screen.getByText("Title bare")).toBeDefined();
  });

  it("makes each row a keyboard-reachable drag handle, with nothing to click", () => {
    renderPanel([option("notes")]);

    const row = screen.getByText("Title notes").closest("[role]");

    expect(row?.getAttribute("role")).toBe("button");
    expect(row?.getAttribute("aria-roledescription")).toBe("draggable");
    expect(row?.className).toContain("cursor-grab");
    expect(
      document.querySelector('[data-slot="sidebar-content"] button'),
    ).toBeNull();
  });

  it("keeps the edit actions it is handed at the foot of the panel", () => {
    renderPanel([option("notes")], {
      actions: <button type="button">Save</button>,
    });

    const footer = document.querySelector('[data-slot="sidebar-footer"]');

    expect(footer?.querySelector("button")?.textContent).toBe("Save");
  });

  it("has no footer when there are no actions to put in it", () => {
    renderPanel([option("notes")]);

    expect(document.querySelector('[data-slot="sidebar-footer"]')).toBeNull();
  });

  it("heads each category with its title", () => {
    renderPanel([
      option("notes"),
      option("stats", {
        category: { id: "@vitnode/blog:content", title: "Blog content" },
      }),
    ]);

    expect(screen.getByRole("heading", { name: "Core" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Blog content" })).toBeDefined();
  });

  it("narrows the list as the admin searches", () => {
    renderPanel([option("notes"), option("stats")]);

    fireEvent.change(search(), { target: { value: "notes" } });

    expect(screen.getByText("Title notes")).toBeDefined();
    expect(screen.queryByText("Title stats")).toBeNull();
  });

  it("drops a category heading the search empties out", () => {
    renderPanel([
      option("notes"),
      option("stats", {
        category: { id: "@vitnode/blog:content", title: "Blog content" },
      }),
    ]);

    fireEvent.change(search(), { target: { value: "notes" } });

    expect(screen.queryByRole("heading", { name: "Blog content" })).toBeNull();
  });

  it("says so when nothing matches", () => {
    renderPanel([option("notes")]);

    fireEvent.change(search(), { target: { value: "forums" } });

    expect(
      screen.getByText("admin.dashboard.widgets.panel.no_results_title"),
    ).toBeDefined();
  });

  it("forgets the search once the panel closes", () => {
    const setOpen = renderPanel([option("notes"), option("stats")]);

    fireEvent.change(search(), { target: { value: "notes" } });
    setOpen(false);
    setOpen(true);

    expect(search()).toHaveProperty("value", "");
    expect(screen.getByText("Title stats")).toBeDefined();
  });

  it("hides the search box when there is nothing left to search", () => {
    renderPanel([]);

    expect(
      screen.queryByPlaceholderText("admin.dashboard.widgets.panel.search"),
    ).toBeNull();
  });

  it("shows the empty state once everything is on the board", () => {
    renderPanel([]);

    expect(
      screen.getByText("admin.dashboard.widgets.panel.empty_title"),
    ).toBeDefined();
  });

  it("is a rail pinned to the right edge from `md` up when open", () => {
    renderPanel([option("notes")]);

    const panel = document.querySelector(
      '[data-slot="sidebar"]',
    )?.parentElement;

    expect(panel?.className).toContain("md:fixed");
    expect(panel?.className).toContain("md:inset-e-0");
    expect(panel?.className).not.toContain("md:translate-x-full");
    expect(panel?.getAttribute("inert")).toBeNull();
  });

  it("slides off-canvas and goes inert while closed", () => {
    renderPanel([option("notes")], { isOpen: false });

    const panel = document.querySelector(
      '[data-slot="sidebar"]',
    )?.parentElement;

    expect(panel?.className).toContain("md:translate-x-full");
    expect(panel?.className).toContain("hidden");
    expect(panel?.getAttribute("inert")).not.toBeNull();
  });
});

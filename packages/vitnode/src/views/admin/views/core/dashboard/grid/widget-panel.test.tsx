import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";

import type { DashboardWidgetOption } from "../widgets/types";

import { WidgetPanel } from "./widget-panel";

vi.mock("use-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

const notes: DashboardWidgetOption = {
  category: { id: "@vitnode/core", title: "Core" },
  defaultRows: 2,
  defaultSpan: 2,
  desc: "A private scratchpad.",
  id: "@vitnode/core:notes",
  minSpan: 1,
  title: "Notes",
};

const renderPanel = (onAdd: (widget: DashboardWidgetOption) => void) =>
  render(
    <SidebarProvider>
      <WidgetPanel isOpen onAdd={onAdd} widgets={[notes]} />
    </SidebarProvider>,
  );

describe("the dashboard's widget panel", () => {
  it("adds a widget when it is clicked, not only when it is dragged", () => {
    const onAdd = vi.fn();

    renderPanel(onAdd);
    fireEvent.click(screen.getByRole("button", { name: "panel.add" }));

    expect(onAdd).toHaveBeenCalledWith(notes);
  });

  it("steps aside for the selected widget's properties", () => {
    render(
      <SidebarProvider>
        <WidgetPanel
          isOpen
          onAdd={vi.fn()}
          properties={<section aria-label="Notes properties" />}
          widgets={[notes]}
        />
      </SidebarProvider>,
    );

    expect(
      screen.getByRole("region", { name: "Notes properties" }),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: "panel.add" })).toBeNull();
  });
});

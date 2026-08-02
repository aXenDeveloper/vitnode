import {
  DndContext,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DashboardWidgetView } from "../widgets/types";

import { loadWidgetSettingsAction } from "../widgets/load-widget-settings.server";
import { WidgetCard } from "./widget-card";

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      values
        ? `${namespace}.${key}:${Object.values(values).join(",")}`
        : `${namespace}.${key}`;

    return t;
  },
}));

// The settings dialog reaches for its server actions, which drag the whole API
// in behind `fetcher`.
vi.mock("../widgets/save-widget-settings.server", () => ({
  saveWidgetSettingsMutation: vi.fn(),
}));
vi.mock("../widgets/load-widget-settings.server", () => ({
  loadWidgetSettingsAction: vi.fn(),
}));

let mounts = 0;

/** Stands in for whatever client state a widget's own content holds. */
const Content = () => {
  React.useEffect(() => {
    mounts += 1;
  }, []);

  return <p>note body</p>;
};

const view = (
  overrides: Partial<DashboardWidgetView> = {},
): DashboardWidgetView => ({
  id: "@vitnode/core:notes",
  instanceId: "@vitnode/core:notes",
  title: "Notes",
  category: { id: "@vitnode/core", title: "Core" },
  minSpan: 1,
  defaultSpan: 1,
  defaultRows: 1,
  span: 1,
  rows: 1,
  contentKey: "{}",
  content: <Content />,
  ...overrides,
});

/** Mirrors the board's own keyboard sensor, which is what a11y hangs on. */
const Board = ({
  children,
  onDragStart,
}: {
  children: React.ReactNode;
  onDragStart?: () => void;
}) => {
  const sensors = useSensors(
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  return (
    <DndContext onDragStart={onDragStart} sensors={sensors}>
      {children}
    </DndContext>
  );
};

const renderCard = (
  widget: DashboardWidgetView,
  isEditing = true,
  onDragStart?: () => void,
) => {
  const tree = (next: DashboardWidgetView) => (
    <Board onDragStart={onDragStart}>
      <SortableContext items={[next.instanceId]}>
        <WidgetCard
          isEditing={isEditing}
          onRemove={vi.fn()}
          onResize={vi.fn()}
          onSettingsSaved={vi.fn()}
          widget={next}
        />
      </SortableContext>
    </Board>
  );

  const result = render(tree(widget));

  return {
    card: result.container.firstElementChild,
    rerender: (next: DashboardWidgetView) => result.rerender(tree(next)),
  };
};

const handle = () =>
  screen.getByRole("button", {
    name: "admin.dashboard.widgets.drag_handle:Notes",
  });

const gear = () =>
  screen.getByRole("button", {
    name: "admin.dashboard.widgets.settings.open:Notes",
  });

const queryGear = () =>
  screen.queryByRole("button", {
    name: "admin.dashboard.widgets.settings.open:Notes",
  });

const closeDialog = async () => {
  fireEvent.click(screen.getByRole("button", { name: "core.global.close" }));

  await waitFor(() => expect(screen.queryByRole("dialog")).toBe(null));
};

describe("WidgetCard", () => {
  describe("drag affordance", () => {
    it("hangs the accessible handle off a button of its own", () => {
      renderCard(view());

      expect(handle().tagName).toBe("BUTTON");
    });

    // A card announced as a button may not hold the buttons that configure,
    // resize and remove it, so the ARIA goes on the handle and the card keeps
    // only the pointer listeners.
    it("does not announce the card itself as a button", () => {
      const { card } = renderCard(view());

      expect(card?.getAttribute("role")).toBe(null);
      expect(card?.getAttribute("tabindex")).toBe(null);
    });

    it("leaves the card's own buttons outside any button role", () => {
      renderCard(view());

      const remove = screen.getByRole("button", {
        name: "admin.dashboard.widgets.remove:Notes",
      });

      expect(remove.parentElement?.closest('[role="button"]')).toBe(null);
    });

    it("offers nothing to drag until the board is being edited", () => {
      renderCard(view(), false);

      expect(
        screen.queryByRole("button", {
          name: "admin.dashboard.widgets.drag_handle:Notes",
        }),
      ).toBe(null);
    });

    // The keydown lands on the handle and reaches the card's listeners by
    // bubbling. dnd-kit refuses to start unless the event came from the
    // registered activator node, so this is what proves the two agree.
    it("lifts the card from the keyboard", () => {
      const onDragStart = vi.fn();
      renderCard(view(), true, onDragStart);

      fireEvent.keyDown(handle(), { code: "Space" });

      expect(onDragStart).toHaveBeenCalledTimes(1);
    });

    it("does not lift the card from its own action buttons", () => {
      const onDragStart = vi.fn();
      renderCard(view(), true, onDragStart);

      fireEvent.keyDown(
        screen.getByRole("button", {
          name: "admin.dashboard.widgets.remove:Notes",
        }),
        { code: "Space" },
      );

      expect(onDragStart).not.toHaveBeenCalled();
    });
  });

  describe("content key", () => {
    it("starts the content over when the server sends new settings", () => {
      mounts = 0;
      const { rerender } = renderCard(view({ contentKey: '{"content":"a"}' }));
      expect(mounts).toBe(1);

      rerender(view({ contentKey: '{"content":"b"}' }));

      expect(mounts).toBe(2);
    });

    it("leaves the content alone on an ordinary re-render", () => {
      mounts = 0;
      const { rerender } = renderCard(view({ span: 1 }));
      expect(mounts).toBe(1);

      rerender(view({ span: 2 }));

      expect(mounts).toBe(1);
    });
  });

  describe("settings", () => {
    beforeEach(() => {
      vi.mocked(loadWidgetSettingsAction).mockClear().mockResolvedValue(null);
    });

    it("offers no gear to a widget that registered no settings form", () => {
      renderCard(view());

      expect(queryGear()).toBe(null);
    });

    it("asks the server for nothing until the gear is pressed", () => {
      renderCard(view({ hasSettings: true }));

      expect(queryGear()).not.toBe(null);
      expect(loadWidgetSettingsAction).not.toHaveBeenCalled();
    });

    it("fetches the form for this copy when the gear is pressed", async () => {
      renderCard(
        view({ hasSettings: true, instanceId: "@vitnode/core:notes#2" }),
      );

      fireEvent.click(gear());

      await waitFor(() =>
        expect(loadWidgetSettingsAction).toHaveBeenCalledWith({
          widgetId: "@vitnode/core:notes#2",
        }),
      );
    });

    it("keeps the form it fetched when the dialog is opened again", async () => {
      renderCard(view({ hasSettings: true }));

      fireEvent.click(gear());
      await waitFor(() =>
        expect(loadWidgetSettingsAction).toHaveBeenCalledTimes(1),
      );
      await closeDialog();

      fireEvent.click(gear());

      await waitFor(() => expect(screen.getByRole("dialog")).not.toBe(null));
      expect(loadWidgetSettingsAction).toHaveBeenCalledTimes(1);
    });

    it("drops the form once the server sends new settings", async () => {
      const { rerender } = renderCard(
        view({ contentKey: '{"range":"month"}', hasSettings: true }),
      );

      fireEvent.click(gear());
      await waitFor(() =>
        expect(loadWidgetSettingsAction).toHaveBeenCalledTimes(1),
      );
      await closeDialog();

      rerender(view({ contentKey: '{"range":"year"}', hasSettings: true }));
      fireEvent.click(gear());

      await waitFor(() =>
        expect(loadWidgetSettingsAction).toHaveBeenCalledTimes(2),
      );
    });
  });
});

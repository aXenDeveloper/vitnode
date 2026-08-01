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
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { DashboardWidgetView } from "../widgets/types";

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

// The settings dialog reaches for the server action, which drags the whole API
// in behind `fetcher`.
vi.mock("../widgets/save-widget-settings.server", () => ({
  saveWidgetSettingsMutation: vi.fn(),
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
});

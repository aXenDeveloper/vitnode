import type {
  AdminDashboardWidgetSpan,
  DashboardLayoutItem,
  DashboardWidgetOption,
} from "../widgets/types";

import { nextInstanceId } from "../widgets/instance-id";

export type DashboardLayoutState = DashboardLayoutItem[];

export type DashboardLayoutAction =
  | { id: string; span: AdminDashboardWidgetSpan; type: "resize" }
  | { id: string; type: "remove" }
  | { index: number; toIndex: number; type: "move" }
  | { index?: number; type: "add"; widget: DashboardWidgetOption }
  | { state: DashboardLayoutState; type: "reset" };

const moveItem = <T>(items: T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || from >= items.length) return items;

  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(Math.min(Math.max(to, 0), next.length), 0, item);

  return next;
};

export const dashboardLayoutReducer = (
  state: DashboardLayoutState,
  action: DashboardLayoutAction,
): DashboardLayoutState => {
  switch (action.type) {
    case "add": {
      const taken = state.map(item => item.id);
      // One copy only, unless the widget says otherwise.
      if (!action.widget.allowMultiple && taken.includes(action.widget.id)) {
        return state;
      }

      const item: DashboardLayoutItem = {
        id: nextInstanceId(action.widget.id, taken),
        span: Math.max(
          action.widget.defaultSpan,
          action.widget.minSpan,
        ) as AdminDashboardWidgetSpan,
        rows: action.widget.defaultRows,
      };
      const next = [...state];
      next.splice(action.index ?? next.length, 0, item);

      return next;
    }

    case "move":
      return moveItem(state, action.index, action.toIndex);

    case "remove": {
      const next = state.filter(item => item.id !== action.id);

      return next.length === state.length ? state : next;
    }

    case "reset":
      return action.state;

    case "resize":
      return state.map(item =>
        item.id === action.id ? { ...item, span: action.span } : item,
      );

    default:
      return state;
  }
};

/** True when the admin has actually changed something worth saving. */
export const isLayoutDirty = (
  a: DashboardLayoutState,
  b: DashboardLayoutState,
): boolean => {
  if (a.length !== b.length) return true;

  return a.some((item, index) => {
    const other = b[index];

    return (
      item.id !== other.id ||
      item.span !== other.span ||
      item.rows !== other.rows
    );
  });
};

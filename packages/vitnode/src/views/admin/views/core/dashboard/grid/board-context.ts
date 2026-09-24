import React from "react";

import type { DashboardActions } from "../widgets/dashboard-actions";
import type {
  DashboardWidgetOption,
  DashboardWidgetView,
} from "../widgets/types";
import type { DashboardLayoutAction } from "./layout-reducer";

export interface DashboardIncomingWidget {
  index: number;
  widget: DashboardWidgetOption;
}

export interface DashboardBoardContextProps {
  actions: DashboardActions;
  addWidget: (widget: DashboardWidgetOption) => void;
  arrivingId: null | string;
  available: DashboardWidgetOption[];
  dispatch: React.Dispatch<DashboardLayoutAction>;
  gridRef: React.RefObject<HTMLDivElement | null>;
  incoming: DashboardIncomingWidget | null;
  isDirty: boolean;
  isEditing: boolean;
  isPending: boolean;
  onCancel: () => void;
  onSave: () => void;
  placed: DashboardWidgetView[];
  refreshWidget: (instanceId: string) => void;
  select: (instanceId: null | string) => void;
  selected: DashboardWidgetView | null;
  setIsEditing: (isEditing: boolean) => void;
}

export const DashboardBoardContext =
  React.createContext<DashboardBoardContextProps | null>(null);

export const useDashboardBoard = () => {
  const context = React.use(DashboardBoardContext);
  if (!context) {
    throw new Error(
      "useDashboardBoard must be used within a DashboardBoardProvider.",
    );
  }

  return context;
};

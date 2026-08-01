const PREFIX = "panel:";

export const panelDraggableId = (widgetId: string): string =>
  `${PREFIX}${widgetId}`;

/** The widget a panel row stands for, or `null` if the id is not a panel row. */
export const panelWidgetId = (draggableId: string): null | string =>
  draggableId.startsWith(PREFIX) ? draggableId.slice(PREFIX.length) : null;

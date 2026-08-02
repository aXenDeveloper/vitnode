import type { AdminDashboardWidgetProps } from "@/lib/plugin";

import { NotesContent } from "./notes-content";

export const NotesWidget = ({
  settings,
  widgetId,
}: AdminDashboardWidgetProps) => {
  const content = typeof settings.content === "string" ? settings.content : "";

  return <NotesContent defaultValue={content} widgetId={widgetId} />;
};

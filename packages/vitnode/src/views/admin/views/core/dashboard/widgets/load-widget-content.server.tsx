"use server";

import { getWidgetInstance } from "./get-widget-instance";

export const loadWidgetContentAction = async ({
  widgetId,
}: {
  widgetId: string;
}): Promise<React.ReactNode> => {
  const instance = await getWidgetInstance(widgetId);
  if (!instance) return null;

  const Widget = instance.widget.component;

  return <Widget settings={instance.settings} widgetId={widgetId} />;
};

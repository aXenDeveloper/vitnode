"use server";

import { getWidgetInstance } from "./get-widget-instance";

export const loadWidgetSettingsAction = async ({
  widgetId,
}: {
  widgetId: string;
}): Promise<React.ReactNode> => {
  const instance = await getWidgetInstance(widgetId);
  const Settings = instance?.widget.settingsComponent;
  if (!Settings) return null;

  return <Settings settings={instance.settings} widgetId={widgetId} />;
};

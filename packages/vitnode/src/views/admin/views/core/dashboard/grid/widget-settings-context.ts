import React from "react";

export interface WidgetSettingsDialogContextProps {
  close: () => void;
  isPending: boolean;
  save: (settings: Record<string, unknown>) => Promise<void>;
  widgetId: string;
}

export const WidgetSettingsDialogContext =
  React.createContext<null | WidgetSettingsDialogContextProps>(null);

/**
 * Saves and closes the settings panel a widget's form is rendered inside.
 * Available to any client component under a widget's `settingsComponent`.
 */
export const useWidgetSettingsDialog = () => {
  const context = React.use(WidgetSettingsDialogContext);
  if (!context) {
    throw new Error(
      "useWidgetSettingsDialog must be used within a widget's settings panel.",
    );
  }

  return context;
};

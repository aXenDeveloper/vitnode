/** How many of the AdminCP dashboard grid's three columns a widget covers. */
export type AdminDashboardWidgetSpan = 1 | 2 | 3;
/** How many AdminCP dashboard grid rows a widget covers. */
export type AdminDashboardWidgetRows = 1 | 2 | 3;
/** A dashboard widget instance's own settings, saved with the admin's layout. */
export type AdminDashboardWidgetSettings = Record<string, unknown>;

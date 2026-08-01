import { NotebookPenIcon, SendIcon } from "lucide-react";

import type { AdminDashboardWidget } from "@/lib/plugin";

import { NotesWidget } from "./notes/notes-widget";
import { SendNotificationSettings } from "./send-notification/send-notification-settings";
import { SendNotificationWidget } from "./send-notification/send-notification-widget";

/**
 * Widgets core ships with. Plugins add their own through
 * `buildPlugin({ admin: { dashboard: { widgets: [...] } } })`.
 */
export const coreDashboardWidgets: AdminDashboardWidget[] = [
  {
    id: "notes",
    component: NotesWidget,
    icon: <NotebookPenIcon />,
    defaultSpan: 2,
    defaultRows: 2,
    defaultEnabled: true,
  },
  {
    id: "send-notification",
    component: SendNotificationWidget,
    settingsComponent: SendNotificationSettings,
    icon: <SendIcon />,
    defaultSpan: 2,
    defaultRows: 1,
    minSpan: 2,
    defaultEnabled: true,
    // Handy more than once - one card per person you keep pinging, each with
    // its own message waiting behind the gear.
    allowMultiple: true,
  },
];

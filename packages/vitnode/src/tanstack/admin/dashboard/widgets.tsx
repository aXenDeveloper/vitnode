"use client";

import { NotebookPenIcon, SendIcon } from "lucide-react";

import type {
  AdminDashboardWidget,
  AdminDashboardWidgetProps,
} from "@/lib/plugin";

import { NotesWidget } from "@/views/admin/views/core/dashboard/widgets/notes/notes-widget";
import { SendNotificationAction } from "@/views/admin/views/core/dashboard/widgets/send-notification/send-notification";
import { SendNotificationSettings } from "@/views/admin/views/core/dashboard/widgets/send-notification/send-notification-settings";

import { useAdminUser } from "../permissions";

/**
 * Core's dashboard widgets, as a browser can render them.
 *
 * The Next.js registry (`views/.../dashboard/widgets/registry.tsx`) is unchanged
 * and stays the source of truth for what core ships. This is the same two
 * widgets with the one difference a browser forces: `SendNotificationWidget`
 * there is an async Server Component that reads `getSessionAdminApi()`, and a
 * browser has no request scope to read.
 *
 * ## Why the list is duplicated rather than shared
 *
 * A widget's `component` may legitimately be a Server Component in Next.js -
 * that is the whole point of rendering the board on the server there - and a
 * Server Component cannot be rendered by a browser at all. So the *registry* is
 * per-runtime while the widgets themselves are not: `NotesWidget` is the
 * identical component in both, and `SendNotificationAction` - the actual form -
 * is shared too. What differs is nine lines of how the default user id is
 * obtained.
 *
 * ## Plugins are not here yet
 *
 * A plugin's widgets reach the Next.js board through `getVitNodeConfig()`, which
 * is server-side config a host deliberately keeps out of its browser bundle
 * (`vitnode.shell.config.ts`). So a TanStack Start host passes its own browser
 * registry - the same seam `AdminShellContent` leaves open for nav
 * `declarations` - and until it has one, the board shows core's widgets. A host
 * that does pass plugin widgets must also warm those plugins' message
 * namespaces, because a widget's title is `<pluginId>.admin.dashboard.widgets.<id>.title`.
 */

/**
 * The send-notification widget, with the signed-in administrator as the default
 * recipient.
 *
 * `useAdminUser` reads the one admin session query the `_admin` guard already
 * filled, so this is a context read rather than a request - the same value
 * `getSessionAdminApi()` gives the Server Component version, from the same
 * session.
 *
 * `null` when there is no admin user, exactly as the server version returns
 * `null` for a missing session. It cannot happen below the guard, and a widget
 * that rendered a "send to user #NaN" form if it ever did would be worse than
 * one that renders nothing.
 */
const SendNotificationBrowserWidget = ({
  settings,
}: AdminDashboardWidgetProps) => {
  const user = useAdminUser();
  if (!user) return null;

  return (
    <SendNotificationAction
      defaultTitle={
        typeof settings.defaultTitle === "string" ? settings.defaultTitle : ""
      }
      defaultUserId={user.id}
    />
  );
};

/**
 * The browser registry, declared to match `coreDashboardWidgets` field for
 * field - the ids, the icons, the default spans and `allowMultiple` are what the
 * *stored* layout refers to, so a difference here would silently orphan an
 * administrator's arrangement.
 */
export const coreDashboardBrowserWidgets: AdminDashboardWidget[] = [
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
    component: SendNotificationBrowserWidget,
    settingsComponent: SendNotificationSettings,
    icon: <SendIcon />,
    defaultSpan: 2,
    defaultRows: 1,
    minSpan: 2,
    defaultEnabled: true,
    allowMultiple: true,
  },
];

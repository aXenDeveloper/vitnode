import type { PermissionsStaffArgs } from "../api/lib/permission-staff";
import type { ItemNavAdmin } from "../views/admin/layouts/sidebar/nav/item";
import type { LocaleMessagesMap } from "./i18n/types";

/**
 * A staff permission a nav item is gated by, scoped to the declaring plugin
 * (the `plugin` is filled in automatically from the plugin's id). When set, the
 * item is hidden from the admin sidebar unless the current admin holds it.
 */
export type AdminNavPermission = Omit<PermissionsStaffArgs, "plugin">;

interface AdminNavItem extends Pick<
  React.ComponentProps<typeof ItemNavAdmin>,
  "href" | "icon" | "isOpenInNewTab"
> {
  id: string;
  permission?: AdminNavPermission;
}

export interface BuildPluginReturn<P extends string = string> {
  admin?: {
    nav?: (AdminNavItem & {
      items?: Omit<AdminNavItem, "icon">[];
    })[];
  };
  /**
   * The plugin's *frontend* strings, usually `import messages from
   * "./locales"`. Merged into the app's message tree at request time - nothing
   * is copied into the app. Server-only strings (emails) go in the separate
   * `messages` on `buildApiPlugin` instead.
   */
  messages?: LocaleMessagesMap;
  pluginId: P;
}

export function buildPlugin<P extends string>(
  props: BuildPluginReturn<P>,
): BuildPluginReturn<P> {
  return props;
}

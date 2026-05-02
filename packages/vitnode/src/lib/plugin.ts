import type { ItemNavAdmin } from "../views/admin/layouts/sidebar/nav/item";

interface AdminNavItem extends Pick<
  React.ComponentProps<typeof ItemNavAdmin>,
  "href" | "icon" | "isOpenInNewTab"
> {
  id: string;
}

export interface BuildPluginReturn<P extends string = string> {
  admin?: {
    nav?: (AdminNavItem & {
      items?: Omit<AdminNavItem, "icon">[];
    })[];
  };
  pluginId: P;
}

export function buildPlugin<P extends string>(
  props: BuildPluginReturn<P>,
): BuildPluginReturn<P> {
  return props;
}

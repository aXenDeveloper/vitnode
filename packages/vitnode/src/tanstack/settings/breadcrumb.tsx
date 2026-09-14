import type { SettingsNavKey } from "@/views/auth/settings/settings-nav";

import { SettingsBreadcrumbContent } from "@/views/auth/settings/settings-breadcrumb-content";

/**
 * One crumb of the settings trail - "Settings" for the frame itself, and the
 * panel's own name below it.
 *
 * Here rather than in the layout's page module because three routes share it,
 * and a page module's job is to export a page: its `default` and its `route`,
 * and nothing anything else imports.
 *
 * The messages it renders from are declared by the `/settings` layout, and the
 * runtime wraps a crumb in its route's namespaces - so there is no
 * `RouteMessages` here.
 */
export const settingsBreadcrumb = (navKey?: SettingsNavKey) =>
  function SettingsBreadcrumb() {
    return <SettingsBreadcrumbContent navKey={navKey} />;
  };

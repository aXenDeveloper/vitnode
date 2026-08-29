import type { SettingsNavKey } from '@vitnode/core/tanstack/settings'

import { RouteMessages } from '@vitnode/core/tanstack/i18n'
import {
  SETTINGS_NAMESPACES,
  SettingsBreadcrumbContent,
} from '@vitnode/core/tanstack/settings'

import { MigrationLink } from '#/migration/link'

/**
 * The settings trail, as this app mounts it.
 *
 * Two things, and the rest is `SettingsBreadcrumbContent`: the strings this
 * subtree renders in - the same set every settings route warms - and the link
 * component, which during the migration asks the route tree per href.
 *
 * The trail itself is derived from the shared navigation model rather than
 * written here, so a panel's crumb and its menu entry cannot drift into two
 * spellings of the same path.
 */
export const SettingsBreadcrumb = ({ navKey }: { navKey?: SettingsNavKey }) => (
  <RouteMessages namespaces={SETTINGS_NAMESPACES}>
    <SettingsBreadcrumbContent LinkComponent={MigrationLink} navKey={navKey} />
  </RouteMessages>
)

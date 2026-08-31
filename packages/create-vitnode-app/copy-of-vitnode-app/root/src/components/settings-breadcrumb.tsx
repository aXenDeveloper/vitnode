import type { SettingsNavKey } from '@vitnode/core/tanstack/settings'

import { RouteMessages } from '@vitnode/core/tanstack/i18n'
import { RouterLink } from '@vitnode/core/tanstack/layout'
import {
  SETTINGS_NAMESPACES,
  SettingsBreadcrumbContent,
} from '@vitnode/core/tanstack/settings'

/**
 * The settings trail, as this app mounts it.
 *
 * Two things, and the rest is `SettingsBreadcrumbContent`: the strings this
 * subtree renders in - the same set every settings route warms - and the link
 * component.
 *
 * `RouterLink` is core's own TanStack answer to that seam, and it is passed
 * rather than defaulted because the crumb itself lives in `views/`, which is
 * shared with hosts on other frameworks and may not import a router. The trail
 * is derived from the shared navigation model rather than written here, so a
 * panel's crumb and its menu entry cannot drift into two spellings of the same
 * path.
 */
export const SettingsBreadcrumb = ({ navKey }: { navKey?: SettingsNavKey }) => (
  <RouteMessages namespaces={SETTINGS_NAMESPACES}>
    <SettingsBreadcrumbContent LinkComponent={RouterLink} navKey={navKey} />
  </RouteMessages>
)

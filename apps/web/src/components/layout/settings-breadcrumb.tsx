import type { SettingsNavKey } from '@vitnode/core/views/auth/settings/settings-nav'

import {
  SETTINGS_ROOT_HREF,
  settingsNavHref,
} from '@vitnode/core/views/auth/settings/settings-nav'
import { BreadcrumbMainContent } from '@vitnode/core/views/breadcrumb/breadcrumb-main-content'
import { useTranslations } from 'use-intl'

import { MigrationLink } from '#/components/migration-link'
import { RouteMessages } from '#/components/route-messages'
import { SETTINGS_NAMESPACES } from '#/lib/settings/panel'

/**
 * The settings breadcrumb - the first crumb in this app that is more than one
 * level deep.
 *
 *     /settings                Settings
 *     /settings/overview       Settings › Overview
 *     /settings/security       Settings › Security
 *
 * Which is exactly what the Next.js `@breadcrumb` slot renders for those URLs
 * (`routes/breadcrumb/main/settings/**`), through the same core components: the
 * trail is `BreadcrumbMainContent`, so the markup, the spacing and the
 * "everything but the last crumb is a link" rule are not restated here.
 *
 * ## A route declares it; this only renders it
 *
 * Each settings route puts `staticData: { breadcrumb: <SettingsBreadcrumb … /> }`
 * next to its own component, and `breadcrumbOf` picks the deepest declaration -
 * so `/settings/security` shows the two-crumb trail and `/settings` inherits the
 * layout's one-crumb one by declaring nothing. There is no map from pathname to
 * label anywhere: the `navKey` a route passes is the one it already uses for its
 * own tab title, and the href for it comes from the shared navigation model.
 *
 * ## Why it mounts its own provider
 *
 * The crumb is rendered by the *shell* - `_main` passes `<MainBreadcrumb />` to
 * `ThemeLayoutContent` - which is above the settings layout and therefore above
 * its `RouteMessages`. So the element a settings route declares renders in a tree
 * where only `core.global` is provided, and has to bring `core.auth.settings`
 * with it. The set is the same one the settings layout's loader has already
 * warmed, so this is a cache read and nothing suspends.
 *
 * `MigrationLink` rather than the router's `Link`: `/settings` is migrated and
 * navigates client-side, and the same component keeps working unchanged for a
 * crumb that points at a path the Next.js app still serves.
 */
const SettingsBreadcrumbTrail = ({ navKey }: { navKey?: SettingsNavKey }) => {
  const t = useTranslations('core.auth.settings')
  const tNav = useTranslations('core.auth.settings.nav')

  /**
   * The panel's own path, from the navigation model rather than assembled here,
   * so the crumb cannot point somewhere the nav does not.
   */
  const href = navKey ? settingsNavHref(navKey) : SETTINGS_ROOT_HREF

  return (
    <BreadcrumbMainContent
      labels={{
        [SETTINGS_ROOT_HREF]: t('title'),
        ...(navKey ? { [href]: tNav(navKey) } : {}),
      }}
      LinkComponent={MigrationLink}
      // Derived from the href for the same reason the labels are keyed by it:
      // `resolveMainBreadcrumb` rebuilds a cumulative path per segment, and two
      // independent spellings of the same route would silently stop matching.
      segments={href.split('/').filter(Boolean)}
    />
  )
}

export const SettingsBreadcrumb = ({ navKey }: { navKey?: SettingsNavKey }) => (
  <RouteMessages namespaces={SETTINGS_NAMESPACES}>
    <SettingsBreadcrumbTrail navKey={navKey} />
  </RouteMessages>
)

import type { AdminUserSearch } from '@vitnode/core/tanstack/admin'

import { AdminShellContent } from '@vitnode/core/tanstack/admin'
import { LanguageSwitcher } from '@vitnode/core/tanstack/layout'

import { adminNav } from '#/lib/admin-nav'
import { adminUserSearchFn } from '#/lib/admin-search'
import { MigrationLink } from '#/migration/link'
import { useMigrationNavigate } from '#/migration/navigation'

/**
 * The AdminCP shell, as this app mounts it.
 *
 * Everything the panel *is* - the sidebar, the header, the palette, the user
 * menu, the breadcrumb area and the one `<main>` - is
 * `AdminShellContent`'s. What is bound here is only what a package cannot
 * answer for a half-migrated application:
 *
 *     LinkComponent   MigrationLink          decides per href which app serves it
 *     onNavigate      useMigrationNavigate   the same decision, without a click
 *     searchUsers     adminUserSearchFn      this app's own server function
 *     languageSwitcher  <LanguageSwitcher/>  the router's, not next-intl's
 *     nav             adminNav               the plugins *this* app configured
 *
 * ## Why the link seam matters more in the AdminCP than anywhere else
 *
 * Stage 12 moved `/admin` and `/admin/core/*` here; `/admin/content/*` - the
 * whole Content Engine - is still the Next.js application's and is Stage 13's to
 * move. The sidebar links to both, because the navigation model is complete
 * regardless of which application currently renders a destination: routes and
 * navigation are separate concepts, and a nav entry naming a screen this router
 * cannot match is the normal case here rather than an error.
 *
 * `MigrationLink` is what makes that work. It asks the route tree per href, so
 * `/admin/core/users` is a client navigation and
 * `/admin/content/blog/articles` is a document load into the legacy app. There
 * is no list of migrated admin routes here or anywhere else - the route tree is
 * the table - so migrating a screen in a later stage changes a route file and
 * not this component.
 *
 * ## `nav` is a projection, not the plugin registry
 *
 * `src/vitnode.config.ts` is server-side and registers the *full* plugin
 * frontends, whose content types carry their editing screens - a graph this
 * application cannot bundle while the Content Engine is still Next's. So the
 * sidebar is built from `#/lib/admin-nav`, which reads the generated
 * browser-safe projection: ids, hrefs, permissions, icons and content type
 * definitions, and nothing that renders a screen.
 *
 * It carries the message namespaces with it, because a plugin group's headings
 * live under that plugin's own id and the shell would otherwise render them as
 * dotted identifiers. `_admin`'s loader warms the same list.
 *
 * No navigation is derived from the route manifest, in either direction.
 */
const searchUsers: AdminUserSearch = async (search) =>
  await adminUserSearchFn({ data: { search } })

export const AdminShell = ({ children }: { children: React.ReactNode }) => {
  const navigate = useMigrationNavigate()

  return (
    <AdminShellContent
      languageSwitcher={<LanguageSwitcher />}
      LinkComponent={MigrationLink}
      nav={adminNav}
      onNavigate={(href) => {
        void navigate(href)
      }}
      searchUsers={searchUsers}
    >
      {children}
    </AdminShellContent>
  )
}

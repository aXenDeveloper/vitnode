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
 * Stage 12 moved `/admin` and `/admin/core/*` here and Stage 13 added
 * `/admin/content/*`, the whole Content Engine. The sidebar has linked to all of
 * it throughout, because the navigation model is complete regardless of which
 * application currently renders a destination: routes and navigation are
 * separate concepts, and a nav entry naming a screen this router cannot match is
 * the normal case here rather than an error.
 *
 * `MigrationLink` is what makes that work. It asks the route tree per href, so
 * `/admin/core/users` and `/admin/content/blog/articles` are client navigations
 * and an admin screen no route declares is a document load into the legacy app.
 * There is no list of migrated admin routes here or anywhere else - the route
 * tree is the table - which is why Stage 13 flipped every content link to a
 * client navigation by adding one route file and editing neither this component
 * nor the navigation it is handed.
 *
 * ## `nav` is a projection, not the plugin registry
 *
 * `src/vitnode.config.ts` is server-side and carries message loaders, which a
 * browser bundle has no business holding. So the sidebar is built from
 * `#/lib/admin-nav`, which reads the generated browser-safe projection: ids,
 * hrefs, permissions, icons and content type definitions, and nothing that
 * renders a screen. The screens have a projection of their own - see
 * `#/lib/content-registry`, which the content route imports so that a plugin's
 * editor fields and form layouts land in that route's chunk rather than in the
 * shell's.
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

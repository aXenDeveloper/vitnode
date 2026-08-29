import type { AdminUserSearch } from '@vitnode/core/tanstack/admin'

import { AdminShellContent } from '@vitnode/core/tanstack/admin'
import { LanguageSwitcher } from '@vitnode/core/tanstack/layout'

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
 * ## `declarations` is deliberately not passed
 *
 * `AdminShellContent` falls back to core's own navigation, which is correct for
 * this app today: `src/vitnode.config.ts` registers its plugins by id and
 * messages only - no content types and no `admin.nav` - and the config itself is
 * server-side, deliberately kept out of the browser bundle by
 * `vitnode.shell.config.ts`. So there are no plugin nav entries to declare yet,
 * and passing `{ plugins: [] }` explicitly would say the same thing twice.
 *
 * When plugin AdminCP registration moves over, this is the one line that
 * changes: pass `adminNavDeclarations(<browser-safe plugin declarations>)` and
 * the plugin groups appear. Nothing in the shell has to change with it, and no
 * navigation is derived from the route manifest.
 */
const searchUsers: AdminUserSearch = async (search) =>
  await adminUserSearchFn({ data: { search } })

export const AdminShell = ({ children }: { children: React.ReactNode }) => {
  const navigate = useMigrationNavigate()

  return (
    <AdminShellContent
      languageSwitcher={<LanguageSwitcher />}
      LinkComponent={MigrationLink}
      onNavigate={(href) => {
        void navigate(href)
      }}
      searchUsers={searchUsers}
    >
      {children}
    </AdminShellContent>
  )
}

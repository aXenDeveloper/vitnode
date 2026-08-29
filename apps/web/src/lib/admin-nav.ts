import { adminNavBundle } from '@vitnode/core/tanstack/admin'

import { pluginAdminNav } from '#/admin-nav.gen'

/**
 * This installation's AdminCP navigation - core's own, plus whatever the plugins
 * it configured contribute.
 *
 * Two lines, and both of them are host-only work by necessity. Which plugins are
 * installed is a property of this application, and `src/admin-nav.gen.ts` is
 * where the build writes the answer: one literal import per configured plugin
 * that exports an `admin/nav` module. Every *rule* about what a sidebar contains
 * - which entries a content type earns, how a hand-declared entry is titled,
 * which permission hides one, which message namespaces the result needs - is
 * `@vitnode/core`'s, in `adminNavBundle`. Nothing about navigation is decided
 * here.
 *
 * ## Why it is not read from `vitnode.config.ts`
 *
 * That config is server-side on purpose (`vitnode.shell.config.ts` explains the
 * split), and the plugin registrations in it are the *full* frontend
 * registrations - content types with their editing screens attached, which reach
 * core's form stack and from there `next/dynamic`. A sidebar needs the ids, the
 * hrefs, the permissions, the icons and the content type definitions, all of
 * which are plain data. The generated projection is exactly that half, so the
 * browser gets the navigation without the Content Engine's UI.
 *
 * ## Module scope, and why that matters twice
 *
 * Evaluated once per bundle rather than per render. `AdminShellContent` memoises
 * its namespace list on this object's identity, and `_admin`'s loader warms the
 * messages from the same `namespaces` array the shell then reads - so a stable
 * value here is what makes those one cache entry rather than two.
 *
 * ## Content entries still point at the legacy application
 *
 * A content type's entry is `/admin/content/…`, which the Content Engine owns
 * and Stage 13 migrates. That href is correct now and stays correct after the
 * migration; what changes is only how a click travels, which `MigrationLink`
 * decides per href by asking this router. Routes and navigation are separate
 * concepts, and a nav entry for a screen this router cannot match is the normal
 * case during the migration rather than a fault.
 */
export const adminNav = adminNavBundle({ plugins: pluginAdminNav })

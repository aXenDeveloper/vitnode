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
 * split): it carries message loaders and API wiring, which a browser bundle has
 * no business holding. A sidebar needs the ids, the hrefs, the permissions, the
 * icons and the content type definitions, all of which are plain data. The
 * generated projection is exactly that half, so the browser gets the navigation
 * without the Content Engine's UI - which arrives, when a content screen
 * actually renders, through `src/lib/content-registry.ts` instead.
 *
 * ## Module scope, and why that matters twice
 *
 * Evaluated once per bundle rather than per render. `AdminShellContent` memoises
 * its namespace list on this object's identity, and `_admin`'s loader warms the
 * messages from the same `namespaces` array the shell then reads - so a stable
 * value here is what makes those one cache entry rather than two.
 *
 * ## Content entries were never rewritten, and that is the point
 *
 * A content type's entry is `/admin/content/…`, and it said exactly that while
 * the Next.js application served those screens and still says it now that this
 * one does. Only *how a click travels* changed, and `MigrationLink` decides that
 * per href by asking the router rather than by consulting any list here. Routes
 * and navigation are separate concepts: a nav entry naming a screen this router
 * cannot match is the normal case during the migration rather than a fault.
 */
export const adminNav = adminNavBundle({ plugins: pluginAdminNav })

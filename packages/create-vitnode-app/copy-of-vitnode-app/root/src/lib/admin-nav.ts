import { adminNavBundle } from "@vitnode/core/tanstack/admin";

import { pluginAdminNav } from "#/admin-nav.gen";

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
 * The config does carry each plugin's registration, and a Next.js host walks it
 * in its render pass. Reading it here would make every configured plugin's
 * editing screens reachable from the module the document shell imports, which is
 * the one graph that is never lazy. The generated projection carries exactly
 * what a sidebar needs instead - ids, hrefs, permissions, icons and content type
 * definitions, all plain data - and the Content Engine's UI arrives separately,
 * when a content screen actually renders, through `src/lib/content-registry.ts`.
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
 * A content type's entry is `/admin/content/…`, and it said exactly that
 * through every change in which framework rendered those screens. Only *how a
 * click travels* ever changed, and nothing here was edited for it. Routes and
 * navigation stay separate concepts: nothing derives a nav entry from a route
 * file, and nothing makes one conditional on a route existing.
 */
export const adminNav = adminNavBundle({ plugins: pluginAdminNav });

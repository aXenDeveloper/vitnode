import type { StaffPermissionSet } from '@vitnode/core/api/lib/permission-staff'
import type { AdminNavTranslator } from '@vitnode/core/tanstack/admin'

import { EMPTY_STAFF_PERMISSION_SET } from '@vitnode/core/api/lib/staff-permission'
import {
  adminNavNamespaces,
  buildAdminNav,
  flattenAdminNav,
  resolveAdminNav,
} from '@vitnode/core/tanstack/admin'
import { isExternalHref } from '@vitnode/core/views/admin/layouts/normalize-url'
import { describe, expect, it } from 'vitest'

import { adminNav } from '#/lib/admin-nav'
import { isTanStackOwnedPath } from '#/migration/navigation'
import { getRouter } from '#/router'

/**
 * Where the AdminCP sidebar's entries actually lead, in a half-migrated app.
 *
 * The nav model and the route tree are tested separately and thoroughly - one in
 * `packages/vitnode`, the other in `admin-routes.test.ts`. What neither can see
 * on its own is the join between them, which is the thing Stage 12 actually
 * ships: the sidebar names every AdminCP screen the installation has, and only
 * some of them are served by this router - after Wave 1, the dashboard, the two
 * system screens and the three advanced ones. `MigrationLink` asks per href, so an
 * entry pointing at a screen the Next.js app still renders becomes a document
 * load rather than a client-side navigation into a route that cannot match.
 *
 * The failure this guards against is silent and total. If `/admin/content/...`
 * ever started answering "owned", every content screen would become a TanStack
 * not-found reached from a working sidebar link - no error, no build failure,
 * just a panel that stops working.
 *
 * ## Routes and navigation stay separate concepts
 *
 * Nothing here derives navigation from the route tree, in either direction. The
 * nav is built from configuration and permissions; the router is asked
 * afterwards, per href, purely to decide *how* to travel. That is why a nav
 * entry for an unmigrated screen is the normal case rather than a bug, and why
 * migrating one later changes a route file and nothing else.
 */

const t: AdminNavTranslator = Object.assign((key: string): string => key, {
  has: () => false,
})

const root: StaffPermissionSet = { root: true, permissions: [] }

const owns = (href: string): boolean => isTanStackOwnedPath(getRouter(), href)

/** Every destination the sidebar offers a root administrator. */
const navHrefs = (plugins: unknown[] = []): string[] =>
  flattenAdminNav(
    buildAdminNav({
      permissions: root,
      t,
      vitNodeConfig: { plugins } as never,
    }),
  ).map((item) => item.href)

describe('the AdminCP navigation names screens both applications serve', () => {
  it('offers the whole core panel, migrated or not', () => {
    const hrefs = navHrefs()

    expect(hrefs).toContain('/admin/core/')
    expect(hrefs).toContain('/admin/core/users/roles')
    expect(hrefs).toContain('/admin/core/advanced/queue')
  })

  /**
   * What Wave 1 moved: the dashboard, the two system screens and the three
   * advanced ones. Written out rather than derived, so adding a route file is
   * not enough to change what this test believes - somebody has to say so here
   * too.
   *
   * `/admin/core/debug` is deliberately absent. It is a real migrated route, and
   * it has never had a sidebar entry in either application: it is reached by
   * typing the URL. A nav test can only speak for what the nav offers.
   */
  const WAVE_ONE = [
    '/admin/core/',
    '/admin/core/system/integrations',
    '/admin/core/system/files',
    '/admin/core/advanced/search',
    '/admin/core/advanced/cron',
    '/admin/core/advanced/queue',
  ]

  it('serves every Wave 1 screen the sidebar names', () => {
    const hrefs = navHrefs()

    for (const href of WAVE_ONE) {
      expect(hrefs, `${href} is in the navigation`).toContain(href)
      expect(owns(href), `${href} is owned by this router`).toBe(true)
    }
  })

  /**
   * What Wave 2 moved: the users list, roles, and the two staff lists.
   *
   * The same join, for the four entries the sidebar gained a client navigation
   * for. Their *routes* are pinned in `admin-routes.test.ts`; what is pinned
   * here is that the href the sidebar actually renders is the one that router
   * owns - a nav entry and a route file can agree on a screen and still
   * disagree by a trailing slash, and the cost of that is a document load into
   * an application that no longer serves the page.
   *
   * The create and edit screens are deliberately absent: they are reached from
   * a button and a row, never from the sidebar, so a nav test cannot speak for
   * them.
   */
  const WAVE_TWO = [
    '/admin/core/users',
    '/admin/core/users/roles',
    '/admin/core/staff/moderators',
    '/admin/core/staff/admins',
  ]

  it('serves every Wave 2 screen the sidebar names', () => {
    const hrefs = navHrefs()

    for (const href of WAVE_TWO) {
      expect(hrefs, `${href} is in the navigation`).toContain(href)
      expect(owns(href), `${href} is owned by this router`).toBe(true)
    }
  })

  /**
   * The property that outlives every wave: the sidebar names screens whether or
   * not this router serves them.
   *
   * Deliberately *not* a list of what is still legacy-owned. That list shrinks
   * every wave and two migrations landing at once would each have to edit the
   * other's copy of it; more importantly, an entry being a document load is not
   * a fault to guard against - it is the correct answer for a screen that has
   * not moved. What must stay true is that the navigation is complete either
   * way, which is what makes `MigrationLink`'s per-href question the only thing
   * deciding how anybody travels.
   *
   * The one destination that must *never* be owned is the Content Engine's, and
   * that has its own describe block below.
   */
  it('names screens this router does not serve, and that is not a fault', () => {
    const hrefs = navHrefs()

    expect(hrefs.length).toBeGreaterThan(WAVE_ONE.length)
    // Every entry is a real destination in one application or the other; none is
    // conditional on a route existing here.
    expect(hrefs.every((href) => href.startsWith('/admin/'))).toBe(true)
  })

  it('serves the dashboard itself, so the shell has something to frame', () => {
    expect(owns('/admin/core')).toBe(true)
  })
})

describe('content navigation during Stage 12', () => {
  /**
   * A content type gets a nav entry for free, and it points into
   * `/admin/content/*` - which the Content Engine owns and Stage 13 migrates. The
   * entry is produced regardless, because navigation describes what exists rather
   * than what this router happens to render.
   */
  const plugins = [
    {
      pluginId: '@vitnode/blog',
      contentTypes: [
        {
          definition: {
            admin: { navigation: { enabled: true }, path: 'blog/posts' },
            id: 'blog.post',
            permissionModule: 'content_blog_post',
          },
        },
      ],
    },
  ]

  it('produces a nav entry for a content type', () => {
    expect(navHrefs(plugins)).toContain('/admin/content/blog/posts')
  })

  /**
   * And that entry is a document load, which is the whole of "content stays
   * legacy-owned in Stage 12". No route was added to make the nav easier, and
   * none may be.
   */
  it('routes that entry to the legacy application', () => {
    expect(owns('/admin/content/blog/posts')).toBe(false)
  })
})

describe('external navigation is not a route question at all', () => {
  /**
   * A plugin may point a nav entry at another origin, and the shell must never
   * ask the router about it.
   *
   * Two independent defences, and both are wanted.
   *
   * The shell classifies first (`isExternalHref` -> `adminLinkFor`) and renders
   * a plain anchor, because a link component takes a path in every framework -
   * `next-intl`'s localizes it, TanStack's matches it against a route tree.
   *
   * The seam then refuses to claim another origin at all. That half was added
   * for this feature and fixed a bug latent since Stage 6: `new URL(href, base)`
   * on an absolute URL discards the base, only `.pathname` was read back, and
   * `https://status.example.com` arrived as `/` - matching the front page and
   * being reported as a route this application owns.
   */
  const plugins = [
    {
      pluginId: '@vitnode/example',
      admin: {
        nav: [
          {
            href: 'https://status.example.com',
            id: 'status',
            isOpenInNewTab: true,
          },
        ],
      },
    },
  ]

  it('carries an external href through the model untouched', () => {
    expect(navHrefs(plugins)).toContain('https://status.example.com')
  })

  it('classifies an external entry before any router sees it', () => {
    expect(isExternalHref('https://status.example.com')).toBe(true)
    expect(isExternalHref('/admin/content/blog/posts')).toBe(false)
  })

  it('does not claim another origin', () => {
    expect(owns('https://status.example.com')).toBe(false)
  })

  /**
   * The nastier half of the same bug: a path that *is* a route here, on someone
   * else's origin. A pathname-only rule reports this as owned and client-
   * navigates to this app's `/discover`.
   */
  it('does not claim another origin that happens to share a path', () => {
    expect(owns('https://elsewhere.test/discover')).toBe(false)
  })

  it('still owns an ordinary internal path', () => {
    expect(owns('/discover')).toBe(true)
  })
})

/**
 * The sidebar this application actually renders.
 *
 * Everything above builds navigation from literals, which is the right way to
 * pin the *rules*. This block asks a different question, and it is the one Stage
 * 12 shipped wrong: does the navigation this app hands its shell contain the
 * plugins this app configured? Before the projection existed, `AdminShell`
 * passed nothing and the shell fell back to core's own groups - so every plugin
 * entry and every content type entry the legacy AdminCP shows was simply absent,
 * with no error anywhere to say so.
 *
 * It reads `#/lib/admin-nav`, which is the same object the shell is given, so
 * there is nothing here that could agree with a test and disagree with a
 * browser.
 */
const resolvedFor = (permissions: StaffPermissionSet) =>
  resolveAdminNav({ declarations: adminNav.declarations, permissions, t })

describe('the navigation this app hands its shell', () => {
  it('still has core, and has a group per configured plugin', () => {
    expect(adminNav.declarations.map((group) => group.id)).toEqual([
      'core',
      '@vitnode/blog',
      '@vitnode/example',
    ])
  })

  /**
   * A hand-declared `plugin.admin.nav` entry, on screen. The example plugin's
   * overview is the representative one: it names a plugin route in the admin
   * area, which is a coincidence rather than a mechanism - the two lists are
   * independent.
   */
  it('offers a plugin&apos;s own admin nav entry', () => {
    expect(
      flattenAdminNav(resolvedFor(root)).map((item) => item.href),
    ).toContain('/admin/example')
  })

  /**
   * And the content type entries, which are the ones a naive reading of "Stage
   * 13 owns the Content Engine" would have dropped. Stage 13 owns *rendering*
   * `/admin/content/*`; whether the sidebar links to it is this stage's.
   */
  it('offers every configured content type, pointing at the legacy screens', () => {
    const hrefs = flattenAdminNav(resolvedFor(root)).map((item) => item.href)

    expect(hrefs).toContain('/admin/content/blog/articles')
    expect(hrefs).toContain('/admin/content/example/articles')
    expect(hrefs).toContain('/admin/content/example/categories')
  })

  it('routes those content entries to the legacy application', () => {
    expect(owns('/admin/content/blog/articles')).toBe(false)
    expect(owns('/admin/content/example/articles')).toBe(false)
  })

  it('serves the plugin admin route it names', () => {
    expect(owns('/admin/example')).toBe(true)
  })

  /**
   * Permission filtering is `resolveAdminNav`'s and stays there - this app runs
   * no second filter of its own. An administrator with nothing granted sees the
   * core entries that need no permission, and no plugin group at all: a group
   * whose every entry was hidden is dropped rather than left as an empty
   * heading.
   */
  it('hides a plugin group from an admin who may not view any of it', () => {
    const groups = resolvedFor(EMPTY_STAFF_PERMISSION_SET).map(
      (group) => group.id,
    )

    expect(groups).toContain('core')
    expect(groups).not.toContain('@vitnode/blog')
  })

  /**
   * The example plugin's group survives an empty permission set, because its
   * overview entry deliberately declares no permission - it is open to anybody
   * the AdminCP's own session guard has already let in. Its content entries do
   * not survive with it.
   */
  it('keeps an unpermissioned entry and drops the permissioned ones beside it', () => {
    const hrefs = flattenAdminNav(resolvedFor(EMPTY_STAFF_PERMISSION_SET)).map(
      (item) => item.href,
    )

    expect(hrefs).toContain('/admin/example')
    expect(hrefs).not.toContain('/admin/content/example/articles')
  })

  /**
   * Search is *derived* from the filtered navigation rather than assembled
   * again, which is what stops a hidden screen reappearing in the palette. The
   * shell builds its index with `flattenAdminNav(nav)` over the same resolved
   * tree, so a href search can offer is a href the filter admitted.
   */
  it('cannot surface through search anything the filter removed', () => {
    const visible = flattenAdminNav(
      resolvedFor(EMPTY_STAFF_PERMISSION_SET),
    ).map((item) => item.href)
    const everything = flattenAdminNav(resolvedFor(root)).map(
      (item) => item.href,
    )

    expect(everything).toContain('/admin/content/blog/articles')
    expect(visible).not.toContain('/admin/content/blog/articles')
  })
})

/**
 * Which strings the shell has to load to render the above.
 *
 * Carried by the bundle rather than worked out by the shell, because a plugin's
 * group heading, its content nouns and its declared entries all live under that
 * plugin's own message id - and the failure mode of getting it wrong is not an
 * error but a sidebar of dotted identifiers.
 */
describe('the namespaces that navigation needs', () => {
  it('names one for each thing the sidebar renders, and nothing broader', () => {
    expect(adminNav.namespaces).toEqual([
      '@vitnode/blog.content.category',
      '@vitnode/blog.content.post',
      '@vitnode/blog.title',
      '@vitnode/example.admin.nav',
      '@vitnode/example.content.article',
      '@vitnode/example.content.category',
      '@vitnode/example.title',
      'admin.global',
    ])
  })

  it('never asks for a whole plugin tree', () => {
    expect(adminNav.namespaces).not.toContain('@vitnode/blog')
    expect(adminNav.namespaces).not.toContain('@vitnode/example')
  })

  /**
   * Deduplicated and sorted, so the loader that warms these and the provider
   * that reads them land on one cache entry - and so the list is the same on
   * every machine.
   */
  it('is deduplicated, sorted and derived from the declarations', () => {
    expect(adminNav.namespaces).toEqual([...new Set(adminNav.namespaces)])
    expect(adminNav.namespaces).toEqual([...adminNav.namespaces].sort())
    expect(adminNav.namespaces).toEqual(
      adminNavNamespaces(adminNav.declarations),
    )
  })

  /**
   * Small enough to ask for in one request. `MAX_NAMESPACES` caps the i18n
   * server function at 16, and the shell adds `core.global` and `admin.global`
   * on top of this list.
   */
  it('leaves room for the shell&apos;s own two', () => {
    expect(adminNav.namespaces.length).toBeLessThanOrEqual(14)
  })
})

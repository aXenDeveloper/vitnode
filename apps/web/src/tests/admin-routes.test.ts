import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { getRouter } from '#/router'

import { resolvesToRoute } from './route-tree'
import { withoutComments } from './source'

const here = dirname(fileURLToPath(import.meta.url))
const routesDir = resolve(here, '../routes')

/** The `/admin` sign-in screen, and the pathless shell everything else sits in. */
const ADMIN_ENTRY_ROUTE_ID = '/admin/'
const ADMIN_SHELL_ROUTE_ID = '/_admin'
/** The Content Engine's one splat - Stage 13's whole route surface. */
const CONTENT_ROUTE_ID = '/_admin/admin/content/$'

const matchedIds = (pathname: string): string[] =>
  getRouter()
    .matchRoutes(pathname, undefined)
    .map((match) => match.routeId)

const owns = (href: string): boolean => resolvesToRoute(getRouter(), href)

/**
 * Which admin URLs this router owns, and - far more importantly - which it does
 * not.
 *
 * `matchRoutes` runs no `beforeLoad`, so everything below is matched without a
 * session. What is being asserted is the *tree*, not access: which routes exist,
 * which parent chain they sit in, and whether the deepest match consumed the
 * whole path. Access is `_admin`'s guard, and the shape of that guard is
 * asserted by source below rather than by driving it.
 */

describe('the AdminCP entrance', () => {
  it('serves /admin', () => {
    expect(matchedIds('/admin')).toContain(ADMIN_ENTRY_ROUTE_ID)
    expect(owns('/admin')).toBe(true)
  })

  /**
   * The sign-in screen is outside the guard, and this is the assertion that
   * keeps it there.
   *
   * `_admin` is the admin-session guard; putting the page that exists to
   * *create* a session behind it is a closed loop, and one that would present as
   * an AdminCP nobody can ever sign in to. Same shape as `/login` against
   * `_authenticated`, for the same reason.
   */
  it('does not render /admin inside the guarded shell', () => {
    expect(matchedIds('/admin')).not.toContain(ADMIN_SHELL_ROUTE_ID)
  })

  it('owns /admin whether or not a locale prefix was typed', () => {
    // `/admin` is in `DEFAULT_IGNORED_LOCALE_PATHS`, so `deLocalizeHref` strips
    // the prefix and the route tree - which has no locale in it - matches. The
    // 308 back to `/admin` is `handleLocaleRequest`'s job; ownership must not
    // depend on it having run.
    expect(owns('/pl/admin')).toBe(true)
  })
})

/**
 * The single most breakable thing about the Content Engine's URLs.
 *
 * `/admin/content/*` is served by exactly one splat, `/_admin/admin/content/$`,
 * and the whole of this suite is about how narrow it is. A splat one level up -
 * `_admin/$`, or `/_admin/admin/$`, or making `/admin` a nested layout - would
 * consume every AdminCP URL beneath it, including the ones no route declares.
 * The Content Engine would then render its own not-found for a plugin screen,
 * a typo and a genuinely missing page alike, and the AdminCP's real 404 would
 * become unreachable. Silently, and all at once.
 */
describe('the Content Engine owns its namespace', () => {
  it.each([
    '/admin/content/blog',
    '/admin/content/blog/posts',
    '/admin/content/blog/posts/create',
    '/admin/content/blog/posts/42/edit',
    '/admin/content/anything/at/all',
  ])('%s is served by this router', (pathname) => {
    expect(owns(pathname)).toBe(true)
    expect(matchedIds(pathname)).toContain(ADMIN_SHELL_ROUTE_ID)
    expect(matchedIds(pathname)).toContain(CONTENT_ROUTE_ID)
  })

  /**
   * The bare namespace matches the splat too, with nothing in it.
   *
   * Owned, and then answered by the loader rather than the router: the resolver
   * returns `undefined` for an empty segment list, so `/admin/content` is the
   * AdminCP's not-found. There is no index screen listing every content type,
   * and inventing one here would be a URL the Next.js AdminCP never served.
   */
  it('claims /admin/content itself, and resolves it to nothing', () => {
    expect(matchedIds('/admin/content')).toContain(CONTENT_ROUTE_ID)
  })

  /**
   * The half that must not regress. Everything under `/admin` that no route
   * declares keeps answering `false`, or the splat has widened and the AdminCP's
   * own not-found stops being reachable.
   */
  it.each([
    '/admin/nonexistent',
    '/admin/core/no-such-screen',
    '/admin/some/plugin/screen',
    // Adjacent to the namespace on both sides, and neither is inside it.
    '/admin/contents',
    '/admin/content-types',
  ])('%s is not claimed by the splat', (pathname) => {
    expect(owns(pathname)).toBe(false)
  })

  it('declares something under /admin, so the assertions above are real', () => {
    // The control. A router that declared nothing at all would satisfy every
    // "not claimed" assertion above.
    expect(owns('/admin')).toBe(true)
  })
})

/**
 * Wave 1: the dashboard, the two system screens, the three advanced ones and the
 * debug panel.
 *
 * Asserted as *whole-path* resolution rather than as "a route exists", because
 * a prefix match is not a page: `matchRoutes` answers with the deepest ancestor
 * it can resolve, so a screen whose route file was never added still "matches"
 * at `/admin/core` and would pass a weaker assertion while 404ing on click.
 *
 * `/admin/core/debug` is in this list and not in the sidebar's: it has never had
 * a nav entry in either application and is reached by typing the URL, which is
 * why `admin-nav-destinations.test.ts` cannot speak for it.
 */
describe('the AdminCP dashboard, system, advanced and debug screens', () => {
  it.each([
    '/admin/core',
    '/admin/core/system/integrations',
    '/admin/core/system/files',
    '/admin/core/advanced/search',
    '/admin/core/advanced/cron',
    '/admin/core/advanced/queue',
    '/admin/core/debug',
  ])('%s is served by this router', (pathname) => {
    expect(owns(pathname)).toBe(true)
    expect(matchedIds(pathname)).toContain(ADMIN_SHELL_ROUTE_ID)
  })

  /**
   * Every one of them sits under the guard, and none of them re-implements it.
   * `_admin`'s `beforeLoad` is the only place the admin session is read; a screen
   * that read it again could decide something the guard did not.
   */
  it('leaves the session check to the guard', () => {
    const screens = readdirSync(join(routesDir, '_admin')).map(String)

    for (const name of screens) {
      const source = withoutComments(join(routesDir, '_admin', name))

      expect(source, name).not.toMatch(/ensureAdminAccess|prefetchAdminAccess/)
      expect(source, name).not.toMatch(/redirect\(/)
    }
  })

  /**
   * A screen's own staff permission is checked in the package, in the loader,
   * before its reads - `requireAdminPermission` - and never in the route file.
   * The route files carry topology; the tuple belongs beside the query it gates,
   * where the API route's own declaration can be quoted next to it.
   */
  it('states no permission tuple in a route file', () => {
    const screens = readdirSync(join(routesDir, '_admin')).map(String)

    for (const name of screens) {
      expect(
        withoutComments(join(routesDir, '_admin', name)),
        name,
      ).not.toMatch(/can_view|can_edit|can_delete|can_run|can_clear_cache/)
    }
  })
})

describe('nothing may claim the admin subtree by accident', () => {
  const adminRouteFiles = (): string[] => {
    const nested = join(routesDir, '_admin')

    return [
      ...readdirSync(routesDir).filter((name) => /^_?admin/.test(name)),
      ...(existsSync(nested)
        ? readdirSync(nested, { recursive: true }).map(String)
        : []),
    ]
  }

  /**
   * The Content Engine's splat, and no other.
   *
   * A catch-all child of `_admin` consumes every admin URL beneath it, so the
   * route file naming is the whole mechanism and the file names are what this
   * checks. There is exactly one - `/admin/content/$`, the namespace the
   * Content Engine owns outright - and this is the assertion that keeps it the
   * only one.
   *
   * Written as an allowlist of one rather than as "no splats", because the
   * failure it guards against did not go away when a legitimate splat appeared:
   * `$.tsx` or `admin.$.tsx` beside it would still swallow the whole AdminCP.
   */
  const CONTENT_SPLAT_FILE = 'admin.content.$.tsx'

  it("declares exactly one splat under the admin shell, and it is the Content Engine's", () => {
    const splats = adminRouteFiles().filter((name) =>
      /(^|[./])\$(\.|$)/.test(name),
    )

    expect(splats).toEqual([CONTENT_SPLAT_FILE])
  })

  /**
   * A splat is only as narrow as its path. The file name above could sit at
   * `/admin/content/$` or - one careless rename later - somewhere far wider, and
   * the name alone would not say which, so the route id is asserted too.
   */
  it('mounts that splat at the Content Engine namespace and nowhere wider', () => {
    const ids = Object.keys(getRouter().routesById)
    const splatIds = ids.filter(
      (id) => id.startsWith('/_admin') && id.endsWith('/$'),
    )

    expect(splatIds).toEqual([CONTENT_ROUTE_ID])
  })

  /**
   * `/admin` must stay a leaf. A sibling `admin/` directory would make it a
   * nested layout, at which point `/admin/content/x` partially matches at
   * `/admin` - still failing the whole-path test today, but one careless index
   * route away from claiming the subtree.
   */
  it('keeps /admin a leaf rather than a nested layout', () => {
    expect(existsSync(join(routesDir, 'admin'))).toBe(false)
    expect(existsSync(join(routesDir, 'admin.index.tsx'))).toBe(true)
  })
})

describe('the admin guard', () => {
  const guardSource = () => withoutComments(join(routesDir, '_admin.tsx'))

  it('decides on the admin session, not the public one', () => {
    const source = guardSource()

    // `AuthState.isAdmin` lives on the *public* session and means "may be
    // offered the AdminCP", not "is inside it". They are two cookies.
    expect(source).toMatch(/ensureAdminAccess/)
    expect(source).not.toMatch(/ensureAuthState|canAccessAuthenticatedRoute/)
  })

  /**
   * The assertion this whole stage turns on.
   *
   * `ensureAdminAccess` rejects when the session could not be read at all - a
   * 429, a 500, an API that is not listening - and that rejection must
   * propagate. Catching it and redirecting would sign every administrator out of
   * the AdminCP during an outage and hand them a sign-in form for a session they
   * already hold.
   */
  it('does not catch the failed-read rejection', () => {
    expect(guardSource()).not.toMatch(/\btry\b|\bcatch\b|\.catch\(/)
  })

  it('redirects only on a decision the API actually gave', () => {
    // `canEnterAdmin` is true for `granted` alone, and it is reached only for a
    // resolved value - so the redirect below it cannot be reached by a failure.
    expect(guardSource()).toMatch(/canEnterAdmin\(access\)/)
  })

  it('sends a denied administrator to the entrance, not to the public login', () => {
    const source = guardSource()

    expect(source).toMatch(/ADMIN_ENTRY_PATH/)
    expect(source).not.toMatch(/LOGIN_PATH|['"]\/login['"]/)
  })

  /**
   * Stated as an absence rather than a presence, on purpose.
   *
   * The permission context is mounted from the one admin session query - either
   * here by `AdminPermissionsProvider` or, once the shell lands, by
   * `AdminShellContent`, which mounts the same provider from the same
   * `adminSessionQueryOptions` so core ships a shell that is complete for hosts
   * that are not this one. Which of the two mounts it is composition and may
   * change; what may never change is this route reaching for the underlying
   * context directly, or building a permission state of its own beside it.
   */
  it('builds no permission state of its own', () => {
    const source = guardSource()

    expect(source).not.toMatch(/createContext/)
    expect(source).not.toMatch(/AdminStaffPermissionProvider/)
    expect(source).not.toMatch(/EMPTY_STAFF_PERMISSION_SET/)
  })

  it('warms the shell namespaces its provider reads back', () => {
    expect(guardSource()).toMatch(/loadAdminMessages/)
  })

  /**
   * A hover is not a navigation, and Stage 14's F3 is that the guard had no way
   * of telling them apart.
   *
   * `defaultPreload: 'intent'` runs this whole chain when a pointer rests on a
   * sidebar link, and router-core re-runs `beforeLoad` from the top of the
   * branch every time - it has no staleness gate, unlike a loader. So with
   * `ADMIN_SESSION_STALE_TIME` at zero, crossing the sidebar was one
   * server-function POST and one Hono call per link the mouse passed over.
   *
   * Source rather than behaviour, deliberately: reaching this line by driving
   * the router would need a rendered app, a server function and a real hover,
   * and the property is a two-line one that a reader can check by eye. What
   * matters is that both branches exist and that the *navigation* one is still
   * `ensureAdminAccess`.
   */
  it('reads tolerantly on a preload and strictly on a navigation', () => {
    const source = guardSource()

    expect(source).toMatch(/preload\s*\?/)
    expect(source).toMatch(/preloadAdminAccess\(context\.queryClient\)/)
    expect(source).toMatch(/ensureAdminAccess\(context\.queryClient\)/)
  })

  /**
   * And takes the flag from the router rather than inferring it.
   *
   * `preload: boolean` is on the `beforeLoad` context router-core builds, beside
   * `cause`. Deriving it from anything else - a location comparison, a module
   * flag - would be a second answer to a question the router has already
   * settled, and one that could disagree with it.
   */
  it('takes the preload flag from the router context', () => {
    expect(guardSource()).toMatch(
      /beforeLoad:\s*async\s*\(\{[^}]*\bpreload\b[^}]*\}\)/,
    )
  })

  /**
   * The revocation guarantee, stated as the thing that must not appear.
   *
   * The saving comes from a *second* stale time on the preload path, never from
   * relaxing the one the navigation path reads. A `staleTime` written here - or
   * a `preload: false` on the route, which gates the loader rather than
   * `beforeLoad` and would throw away component-chunk preloading as well -
   * would be the wrong fix wearing the right result.
   */
  it('does not relax the session policy to buy the saving', () => {
    const source = guardSource()

    expect(source).not.toMatch(/staleTime/)
    expect(source).not.toMatch(/preload:\s*false/)
  })

  /**
   * The refusal keeps the panel.
   *
   * A `notFoundComponent` renders *instead of* the component of the route that
   * handles the error, so this one replaces `AdminLayout` - the sidebar, the
   * header and the palette go with it unless the not-found screen mounts the
   * shell itself. An administrator refused a screen would otherwise land on a
   * bare 404 with no way back into the AdminCP, which is not what the Next.js
   * panel does: its `not-found.tsx` sits under `admin/(auth)/layout.tsx`.
   *
   * Checked as source because the property is about the component tree - both
   * spellings render, and only one of them keeps the panel.
   */
  it('renders its not-found inside the shell rather than instead of it', () => {
    const source = guardSource()
    const notFoundScreen = /function AdminNotFoundScreen\(\)[\s\S]*?\n}/.exec(
      source,
    )?.[0]

    expect(notFoundScreen).toBeDefined()
    expect(notFoundScreen).toMatch(/<AdminShell>/)
    expect(notFoundScreen).toMatch(/<AdminNotFound\b/)
  })
})

describe('the sign-in screen', () => {
  const signInSource = () => withoutComments(join(routesDir, 'admin.index.tsx'))

  /**
   * The tolerant read, and the one route where it is correct.
   *
   * `ensureAdminAccess` rejecting would replace the AdminCP's only entrance with
   * an error page, so a partial outage would leave nobody able to sign in and
   * fix it. `prefetchAdminAccess` records the failure in the cache entry instead
   * and the form renders.
   */
  it('reads the session tolerantly, so an outage cannot lock the AdminCP', () => {
    const source = signInSource()

    expect(source).toMatch(/prefetchAdminAccess/)
    expect(source).not.toMatch(/ensureAdminAccess/)
  })

  it('redirects away only for an answer the API gave', () => {
    // `!access` is the failed read; `!canEnterAdmin(access)` is the denial. Both
    // fall through to the form, which is the honest answer for each.
    expect(signInSource()).toMatch(/!access\s*\|\|\s*!canEnterAdmin\(access\)/)
  })

  it('validates where it sends people where the value is used', () => {
    // The search contract keeps whatever arrived and judges nothing; the
    // sanitiser runs at the navigation. Same split as `/login`.
    expect(signInSource()).toMatch(/sanitizeAdminReturnTo/)
  })

  it('reuses the shared sign-in screen rather than a second form', () => {
    expect(signInSource()).toMatch(/AdminSignInRouteContent/)
  })
})

/**
 * Wave 2 - users, roles and staff.
 *
 * Nine routes, and the two questions worth pinning about them: that each one
 * resolves to a route of its own, and that the single dynamic segment does not
 * swallow its static sibling.
 */
describe('the AdminCP users, roles and staff screens', () => {
  it.each([
    '/admin/core/users',
    '/admin/core/users/roles',
    '/admin/core/users/123',
    '/admin/core/staff/admins',
    '/admin/core/staff/admins/create',
    '/admin/core/staff/admins/edit/1',
    '/admin/core/staff/moderators',
    '/admin/core/staff/moderators/create',
    '/admin/core/staff/moderators/edit/1',
  ])('%s is served by this router', (pathname) => {
    expect(owns(pathname)).toBe(true)
  })

  it('prefers the static roles route over the dynamic user id', () => {
    // `/admin/core/users/roles` and `/admin/core/users/$id` both match the same
    // shape. TanStack ranks a static segment above a dynamic one, and the roles
    // screen would otherwise be rendered as a user whose id is the word "roles".
    const matched = matchedIds('/admin/core/users/roles')

    expect(matched).toContain('/_admin/admin/core/users/roles')
    expect(matched).not.toContain('/_admin/admin/core/users/$id')
  })

  it.each([
    '/admin/core/users',
    '/admin/core/users/7',
    '/admin/core/users/roles',
    '/admin/core/staff/admins',
    '/admin/core/staff/admins/edit/1',
  ])('renders %s inside the guarded shell', (pathname) => {
    expect(matchedIds(pathname)).toContain(ADMIN_SHELL_ROUTE_ID)
  })

  it.each([
    // A nav *group* with no page of its own - it has never been a URL.
    '/admin/core/staff',
    // One segment too deep on either side of the dynamic route.
    '/admin/core/users/roles/nope',
    '/admin/core/staff/admins/edit',
  ])('does not claim %s', (pathname) => {
    expect(owns(pathname)).toBe(false)
  })
})

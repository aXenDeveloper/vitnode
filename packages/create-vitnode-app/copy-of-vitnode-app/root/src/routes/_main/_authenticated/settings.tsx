import { createFileRoute, Outlet } from '@tanstack/react-router'
import { RouterLink } from '@vitnode/core/tanstack/layout'
import {
  SettingsLayoutContent,
  settingsMessagesQueryOptions,
} from '@vitnode/core/tanstack/settings'

import { SettingsBreadcrumb } from '#/components/settings-breadcrumb'

/**
 * The settings screens' own layout - the heading, the navigation card, and the
 * panel every settings page renders inside.
 *
 * A real nested layout route rather than a wrapper each page remembers to
 * render: `settings.tsx` alongside a `settings/` directory makes this the parent
 * of `/settings`, `/settings/overview` and `/settings/security`, so a panel joins
 * the frame by *where its file lives*. That is the same rule `_main` uses for the
 * application shell and `_authenticated` for the session guard, and it is what
 * keeps the frame from being copied into three (soon four) route files that would
 * then drift.
 *
 * ## Where it sits, and what that buys
 *
 * Under `_main` for the shell and under `_authenticated` for the guard. There is
 * deliberately **no session check in this subtree**: that rule is
 * `routes/_main/_authenticated.tsx`, running in `beforeLoad` before any of this
 * renders. An anonymous visitor to `/settings/security` is answered with
 * `/login?returnTo=/settings/security` - no locale in the round-trip value,
 * because the rewrite writes that back on the way home - and receives no byte of
 * a settings page. A second check here would not be defence in depth, it would
 * be a second rule to keep in step with the first.
 *
 * The frame itself, and what a panel may assume about the provider it mounts,
 * are `@vitnode/core/tanstack/settings`.
 */
export const Route = createFileRoute('/_main/_authenticated/settings')({
  /**
   * The strings the frame renders, warmed before it renders.
   *
   * `ensureQueryData` rather than a prefetch, because `RouteMessages` reads them
   * back with `useSuspenseQuery` and there is no Suspense boundary between it and
   * the document: an unwarmed entry does not degrade here, it suspends the whole
   * response.
   *
   * The session is deliberately not fetched. `_authenticated`'s `beforeLoad` has
   * already put it in the one cache entry every guard reads, and this layout has
   * no use for it - the frame renders nothing about the visitor.
   */
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      settingsMessagesQueryOptions(context.locale),
    )
  },
  /**
   * `noindex, nofollow` for the whole settings subtree, declared exactly once.
   *
   * TanStack Router merges the `head` of every matched route and dedupes `meta`
   * by `name`, preferring the deepest occurrence - so a panel inherits this by
   * saying nothing, and only a panel that deliberately wanted to be indexed would
   * restate the tag. `settingsPanelHead` therefore emits a title and nothing
   * else.
   */
  head: () => ({ meta: [{ content: 'noindex, nofollow', name: 'robots' }] }),
  /**
   * The trail for `/settings` itself - a single "Settings" crumb. A panel
   * declares its own two-crumb trail and wins by being deeper (`breadcrumbOf`),
   * and `/settings` inherits this one by declaring nothing at all.
   */
  staticData: { breadcrumb: <SettingsBreadcrumb /> },
  component: SettingsLayout,
})

/**
 * `SettingsLayoutContent` takes the link as a required prop: it is shared with
 * hosts that are not on TanStack Router, so it may not import one itself. This
 * route supplies core's own `RouterLink`, and every panel the menu lists is a
 * route in this tree - `src/tests/settings-routes.test.ts` pins that.
 */
function SettingsLayout() {
  return (
    <SettingsLayoutContent LinkComponent={RouterLink}>
      <Outlet />
    </SettingsLayoutContent>
  )
}

import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@vitnode/core/components/ui/button'
import { formatPageTitle } from '@vitnode/core/lib/metadata'
import { useTranslations } from 'use-intl'

import { useSignOutAction } from '#/lib/auth/actions'
import { vitNodeShellConfig } from '#/vitnode.shell.config'

/**
 * The Stage 6 verification page, and nothing more.
 *
 * The sibling of `routes/index.tsx`, which has served the same purpose since
 * Stage 3: a page whose only job is to make the stage's runtime observable. No
 * VitNode account feature is migrated here - `/settings` and its three tabs are
 * still the Next.js app's, and Stage 8 moves them under this same
 * `_authenticated` boundary.
 *
 * It exists for three reasons, and each one is a thing that would otherwise be
 * unprovable until Stage 8:
 *
 * 1. **The guard has something to guard.** `_authenticated` is a pathless
 *    layout, and the route generator refuses a childless one - it infers `/` for
 *    it, which collides with the front page. So the boundary needs a first
 *    child, and a page that renders the session it was let in with is the
 *    smallest honest one.
 * 2. **The redirect is real.** Anonymous, this URL answers
 *    `/login?returnTo=/account` - no protected markup is rendered first, because
 *    the decision is made in `beforeLoad`.
 * 3. **Sign-out is wired.** This app mounts no header yet, so there is nowhere
 *    else a sign-out control could live without migrating the shell. The button
 *    below is the narrow alternative: it ends the session, replaces the cached
 *    one, and lets the guard above notice - which lands the visitor back on the
 *    login page, from the rule that owns that decision rather than from anything
 *    here.
 *
 * Delete it when a real account page arrives.
 */
export const Route = createFileRoute('/_main/_authenticated/account')({
  // No loader and no `RouteMessages`: everything this page renders comes from
  // `core.global`, which the root route already warms and provides.
  head: () => ({
    meta: [{ title: formatPageTitle(vitNodeShellConfig.metadata, 'Account') }],
  }),
  component: AccountRoute,
})

function AccountRoute() {
  /**
   * The visitor, from the guard that let this page render.
   *
   * `context.auth` is `_authenticated`'s `beforeLoad` return, already narrowed
   * to the signed-in half of the union - so `auth.user` needs no check here. It
   * is the same object the guard decided on, read from the one canonical session
   * entry, so this page cannot disagree with the rule that admitted it.
   */
  const { auth } = Route.useRouteContext()
  const t = useTranslations('core.global')
  const signOut = useSignOutAction()

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          {auth.user.name}
        </h1>

        <p className="text-muted-foreground leading-relaxed text-pretty">
          Behind the <code>_authenticated</code> boundary. Stage 8 moves
          <code> /settings</code> here; this page is the scaffold that proves
          the guard and the sign-out transition.
        </p>
      </header>

      <section className="bg-card text-card-foreground flex flex-col gap-4 rounded-lg border p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-foreground text-sm leading-relaxed">
            Email
          </span>
          <span className="text-sm" data-testid="account-email">
            {auth.user.email}
          </span>
        </div>

        <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-foreground text-sm leading-relaxed">
            Session - ends here, and the guard above notices
          </span>

          <Button
            onClick={async () => {
              // No `router.invalidate()` here: `useSignOutAction` already does
              // it, and the guard above is what notices.
              await signOut()
            }}
            variant="outline"
          >
            {t('user_bar.log_out')}
          </Button>
        </div>
      </section>
    </div>
  )
}

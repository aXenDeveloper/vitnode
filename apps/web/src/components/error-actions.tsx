import { useRouter } from '@tanstack/react-router'
import { Button, buttonVariants } from '@vitnode/core/components/ui/button'
import { cn } from '@vitnode/core/lib/utils'
import { ArrowLeft, HomeIcon } from 'lucide-react'
import { useTranslations } from 'use-intl'

import { MigrationLink } from '#/components/migration-link'

/**
 * "Go back" and "go home", for a screen that ends in a dead end.
 *
 * The TanStack half of what `ErrorViewActions` renders in Next.js: the same two
 * buttons and the same two strings, with this framework's navigation behind
 * them. Core's error screens take their actions as a slot precisely because this
 * is the part that cannot be shared - `router.history.back()` here,
 * `next-intl`'s `useRouter().back()` there.
 *
 * A component rather than a snippet because two screens outside the main shell
 * need exactly it: the SSO callback's failure states, and the 404 a
 * reset-password page shows on an install with no email adapter. Copied into the
 * second of those, the two would have drifted the first time either string
 * changed.
 *
 * `core.global` comes from the root route, which provides it for every page, so
 * this renders correctly without a `RouteMessages` above it - which matters,
 * because a `notFoundComponent` replaces the component that would have mounted
 * one.
 *
 * Declared at module scope wherever it is used, so it is the same component type
 * on every render.
 */
export const ErrorActions = () => {
  const router = useRouter()
  const t = useTranslations('core.global')

  return (
    <>
      <Button
        onClick={() => {
          router.history.back()
        }}
        size="lg"
        variant="ghost"
      >
        <ArrowLeft />
        {t('go_back')}
      </Button>

      <MigrationLink className={cn(buttonVariants({ size: 'lg' }))} href="/">
        <HomeIcon />
        {t('back_home')}
      </MigrationLink>
    </>
  )
}

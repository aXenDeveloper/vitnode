import { ErrorActions as ErrorActionsContent } from '@vitnode/core/tanstack/layout'

import { MigrationLink } from '#/migration/link'

/**
 * "Go back" and "go home", with this app's migration-aware link behind the
 * second of them.
 *
 * The buttons, the strings and `router.history.back()` are core's - the same
 * pair every VitNode TanStack app renders on a dead-end screen. All this adds is
 * `MigrationLink`, because `/` is served by the Next.js application on some
 * installs and by this one on others, and only the route tree knows which.
 *
 * Bound here rather than at each screen so the two callers - the SSO callback's
 * failure states, and the 404 a reset-password page shows on an install with no
 * email adapter - cannot pass different links. It is also declared at module
 * scope, so it is the same component type on every render.
 */
export const ErrorActions = () => (
  <ErrorActionsContent LinkComponent={MigrationLink} />
)

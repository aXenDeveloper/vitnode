import { Header } from '#/components/header'
import { UserHeader } from '#/components/layout/user-header'

/**
 * The site header, as the main shell's slot for it.
 *
 * Two components and no logic, which is the point: `Header` is the bar - the
 * logo, the nav, the language and theme switchers - and `UserHeader` is the
 * session-dependent half that goes in its action area. Keeping them separate is
 * what lets the bar render from the message cache alone while the user area
 * reads a query that may still be in flight.
 *
 * The logo is `Header`'s default (`LogoVitNode`), as it is in both Next.js apps.
 * An application with its own mark passes one here and changes nothing else.
 *
 * ## What the shell owes this
 *
 * Two warm cache entries, both ensured by `_main`'s loader:
 *
 *     headerIntlQueryOptions  ->  a `useSuspenseQuery`, so this is required
 *     prefetchSession         ->  the first paint shows the visitor, not a gap
 *
 * See the loader in `routes/_main.tsx`, which states why one is `ensure` and the
 * other `prefetch`.
 */
export const MainHeader = () => <Header user={<UserHeader />} />

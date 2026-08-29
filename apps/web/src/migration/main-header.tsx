import { MainHeader as MainHeaderContent } from '@vitnode/core/tanstack/layout'

import { MigrationLink } from '#/migration/link'

/**
 * The site header, as the main shell's slot for it.
 *
 * One line of application. The bar, the nav, the language and theme switchers,
 * the user area and both cache entries they read are
 * `@vitnode/core/tanstack/layout`'s `MainHeader`; what this app adds is the link
 * component, because half of VitNode still runs on Next.js and every header link
 * has to be asked, per href, which application can render it.
 *
 * The logo is core's default (`LogoVitNode`), as it is in both Next.js apps. An
 * application with its own mark passes one here and changes nothing else.
 *
 * ## What the shell owes it
 *
 * Two warm cache entries, both ensured by `_main`'s loader:
 *
 *     headerIntlQueryOptions  ->  a `useSuspenseQuery`, so this is required
 *     prefetchSession         ->  the first paint shows the visitor, not a gap
 *
 * See the loader in `routes/_main.tsx`, which states why one is `ensure` and the
 * other `prefetch`.
 */
export const MainHeader = () => (
  <MainHeaderContent LinkComponent={MigrationLink} />
)

import { LogoVitNodeBrand } from '@vitnode/core/components/logo-vitnode'
import { MainHeader as MainHeaderContent } from '@vitnode/core/tanstack/layout'

/**
 * The site header, as the main shell's slot for it.
 *
 * One line of application. The bar, the nav, the language and theme switchers,
 * the user area and both cache entries they read are
 * `@vitnode/core/tanstack/layout`'s `MainHeader`; what this app adds is the one
 * thing only it can answer.
 *
 * **The mark.** `LogoVitNodeBrand` is core's own - the canonical `LogoVitNode`
 * at whichever of its two sizes the viewport has room for - and it is also what
 * the header would default to, so passing it changes no pixel. What it changes
 * is where the answer lives: this file is vitnode.com, and vitnode.com choosing
 * VitNode's mark is a sentence a site should say out loud rather than inherit.
 * An application with its own mark replaces this one prop.
 *
 * No `LinkComponent`. Every header destination is a route in this application's
 * own tree, so the header's own default - `RouterLink`, the router's `Link` in
 * the shape the shared views ask for - is the right one, and the prop stays
 * available for a host that needs to answer differently.
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
  <MainHeaderContent logo={<LogoVitNodeBrand />} />
)

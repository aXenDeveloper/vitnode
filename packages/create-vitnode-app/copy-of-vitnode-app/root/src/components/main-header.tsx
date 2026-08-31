import { MainHeader as MainHeaderContent } from '@vitnode/core/tanstack/layout'

/**
 * The site header, as the main shell's slot for it.
 *
 * One line of application. The bar, the nav, the language and theme switchers,
 * the user area and both cache entries they read are
 * `@vitnode/core/tanstack/layout`'s `MainHeader`.
 *
 * **Your mark goes here.** Left alone the header renders VitNode's own, which is
 * the right default and the wrong answer for a real site. Pass your own:
 *
 *     <MainHeaderContent logo={<YourLogo />} />
 *
 * This file exists so that choosing a mark is a sentence a site says out loud
 * rather than something it inherits without noticing.
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
export const MainHeader = () => <MainHeaderContent />

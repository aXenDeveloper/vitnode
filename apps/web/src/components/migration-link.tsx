import { Link, useRouter } from '@tanstack/react-router'

import { useLocale } from '#/lib/i18n/client'
import { buildLegacyHref, legacyWebOrigin } from '#/lib/legacy-app'
import { isTanStackOwnedPath } from '#/lib/migration-navigation'

/**
 * Linking to a VitNode page while half of VitNode still runs on Next.js.
 *
 * The set this app owns grows every stage - the front page, `/discover`,
 * `/search`, the auth screens, `/files`, `/settings/*`, the `/api/*` mount and
 * whatever a plugin declares - and links point at plenty of routes it still does
 * not: `/blog/post-30`, `/admin/...`, `/users/<code>`, whatever a plugin indexed.
 * Handing every internal-looking path to `<Link>` routes those into *this*
 * router, which has nothing to match them with, so a perfectly good blog post
 * becomes a TanStack not-found page. During a strangler migration a full document
 * load to the running Next.js app is the correct answer, not a fallback.
 *
 * So: ask the router what it owns, and let it answer.
 *
 *     owned      -> <Link>, client-side navigation, locale prefix from the rewrite
 *     not owned  -> <a href>, document navigation, locale prefix applied here
 *
 * This is deliberately not a cross-framework navigation system, and there is no
 * hand-maintained table of migrated routes - the route tree *is* the table. When
 * `/blog` is migrated it appears in the route tree, `isTanStackOwnedPath` starts
 * answering `true` for it, and nothing here changes. Stage 5 is the proof: a
 * plugin declared `/example`, `lib/plugin-routes.ts` mounted it on the same tree,
 * and this file was not touched. Stage 9 is the second proof and the louder one:
 * `/register` and `/settings` are in the *header's* own link record
 * (`user-header-model.ts`), they were document loads into the Next.js app the day
 * before, and migrating them added route files and edited neither this component
 * nor that record. `src/tests/header-navigation.test.ts` pins it.
 *
 * The rule itself lives in `#/lib/migration-navigation`, because a link is not
 * the only thing that has to make it: an auth flow finishing a sign-in navigates
 * to wherever the visitor was heading, and has to ask exactly the same question.
 * One answer, two callers.
 */

/**
 * A link to anywhere in VitNode, migrated or not.
 *
 * The two branches differ in origin as well as in mechanism, which is the whole
 * point: a relative `/blog/post-1` from this app resolves against *this* app,
 * so it turned a client-side not-found into a full-document not-found rather
 * than reaching the application that owns the route.
 *
 * - **Owned.** `<Link to>` takes the *internal* path and stays relative. The
 *   router's `rewrite.output` writes the locale prefix, so `/discover` renders
 *   as `/pl/discover` while reading Polish. Neither an origin nor a prefix is
 *   added here; either would be a duplicate.
 * - **Not owned.** The router never sees the URL, so `buildLegacyHref` localizes
 *   it with the same Stage 3 rule and points it at the legacy origin.
 *
 * Search parameters and hashes survive both branches untouched.
 *
 * ## Every prop of an anchor, not just three
 *
 * Widened from `{ children, className, href }` for the shared auth screens,
 * which put a link inside a Base UI `render`: that clones the element with the
 * children, the class name *and the ref* it needs to stay a button, so a wrapper
 * accepting only three props would silently drop two of them. The type is now
 * structurally `AuthLinkProps` from `@vitnode/core/views/auth/auth-link`, which
 * is what lets this component be handed straight to `SignInContent`,
 * `SignInFormContent` and `SSOCallbackContent` as their `LinkComponent`.
 */
export type MigrationLinkProps = Omit<React.ComponentProps<'a'>, 'href'> & {
  href: string
}

export const MigrationLink = ({
  children,
  href,
  ...props
}: MigrationLinkProps) => {
  const router = useRouter()
  const locale = useLocale()

  if (isTanStackOwnedPath(router, href)) {
    return (
      <Link {...props} to={href}>
        {children}
      </Link>
    )
  }

  return (
    <a
      {...props}
      href={buildLegacyHref({ href, legacyOrigin: legacyWebOrigin(), locale })}
    >
      {children}
    </a>
  )
}

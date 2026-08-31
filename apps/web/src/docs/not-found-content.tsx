import { Link } from '@tanstack/react-router'
import { buttonVariants } from 'fumadocs-ui/components/ui/button'
import { DocsPage } from 'fumadocs-ui/page'

/**
 * `/docs/does-not-exist`, and every other document that is not there.
 *
 * Rendered *inside* the docs shell - the sidebar, the tabs and the search are
 * still on screen - because a reader who mistyped a URL or followed a stale
 * bookmark is one click from the page they meant, and a bare error screen throws
 * that away.
 *
 * ## It is a 404, and not a redirect
 *
 * The Next.js application sent `/docs` itself to `/docs/dev` with an HTTP
 * redirect, and that one is preserved (`src/routes/_docs/docs.index.tsx`)
 * because `/docs` is a real URL with no landing document behind it. A *missing*
 * document is a different thing: bouncing it to the first section would answer a
 * question nobody asked and would tell a crawler the page exists. So this route
 * answers not-found, which is what `throw notFound()` in `getDocsPage` asks for.
 *
 * The router's `<Link>` directly rather than an injected component: this file is
 * a route's own screen rather than a shared view, both destinations are routes in
 * this tree, and the rewrite writes the locale prefix into each - so from
 * `/pl/docs/nope` the buttons lead to `/pl/docs/dev` and `/pl`.
 */
export const DocsNotFoundContent = () => (
  <DocsPage toc={[]}>
    <div className="flex flex-col items-start gap-4 py-8">
      <p className="text-fd-muted-foreground text-sm font-medium">404</p>

      <h1 className="text-foreground text-3xl font-bold text-balance sm:text-4xl">
        This page does not exist
      </h1>

      <p className="text-muted-foreground max-w-prose leading-relaxed text-pretty">
        The document you are looking for may have been renamed or moved. The
        sidebar has everything that is here.
      </p>

      <div className="flex flex-wrap gap-2">
        <Link
          className={buttonVariants({ color: 'primary' })}
          params={{ _splat: 'dev' }}
          to="/docs/$"
        >
          Browse the documentation
        </Link>

        <Link className={buttonVariants({ color: 'secondary' })} to="/">
          Back to VitNode
        </Link>
      </div>
    </div>
  </DocsPage>
)

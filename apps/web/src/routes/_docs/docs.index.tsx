import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * `/docs` has no page of its own, so it forwards to the first section.
 *
 * The Next.js application did the same thing from `next.config.ts`, with one
 * entry per locale because the rewrite lived outside the app. Here it is one
 * route: `redirect({ to })` hands the router an *internal* path, and the
 * router's own `rewrite.output` writes the prefix back - so `/pl/docs` lands on
 * `/pl/docs/dev` with nothing in this file mentioning a language. That is the
 * whole reason it is `to` and `params` rather than `href`, which bypasses the
 * rewrite.
 *
 * It stays a redirect rather than becoming a hand-written landing page because
 * the content has no `content/docs/index.mdx`. Fumadocs would render one the
 * moment somebody writes it, and this route is the only thing that would then
 * need deleting.
 *
 * In `beforeLoad`, so it is decided before anything is fetched: the shell's page
 * tree is never requested for a URL that immediately leaves. During SSR the
 * throw becomes a real HTTP redirect rather than a rendered page that relocates
 * afterwards.
 */
export const Route = createFileRoute('/_docs/docs/')({
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({ params: { _splat: 'dev' }, to: '/docs/$' })
  },
})

import { defineConfig, defineDocs } from 'fumadocs-mdx/config'
import jsonSchema from 'fumadocs-mdx/plugins/json-schema'

/**
 * The documentation collection, and the three capabilities the site is built on.
 *
 * `dir` is this application's own `content/docs`. Nothing here reads from
 * `apps/docs`: Stage 16 copied the source across, and `apps/web` owns it from
 * now on - see `src/tests/docs-source.test.ts`, which fails if a docs file ever
 * points a reader back at the directory Stage 17 deletes.
 *
 * ## `async` is the lazy half of the server collection
 *
 * Without it, `.source/server.ts` globs every document with `eager: true`, so
 * *reaching* the source loader compiles all ~120 documents - MDX, Shiki
 * highlighting and all - before it can answer which one `/docs/dev` is. That
 * cost lands on the first request to any docs URL in the dev server, and on the
 * SSR pass in production, for a lookup that only ever reads frontmatter.
 *
 * `async: true` splits that glob in two. The frontmatter stays eager, but is
 * transformed with `?only=frontmatter` - a one-line module per file, no MDX
 * compiler - and the body becomes `() => import(…)` behind `page.data.load()`.
 * The page tree, the `<title>` and the 404 are all frontmatter, so a docs
 * request now compiles the one document it is going to render, which is also
 * exactly what the browser collection has always done.
 *
 * Nothing in `src/docs` had to change for it, and that is the point of the seam
 * `src/docs/transport.ts` describes: the body was never read on the server. The
 * two consumers that do want content ask for it asynchronously already -
 * `getText("processed")` in `source.server.ts`, and `createFromSource`, which
 * awaits `structuredData()` when a collection is lazy.
 *
 * `includeProcessedMarkdown` keeps the rendered Markdown of every page next to
 * its compiled component, which is what `/llms-full.txt` is made of. Without it
 * `page.data.getText("processed")` has nothing to return and the LLM output is
 * empty rather than missing. It survives `async`: the Markdown rides in the
 * lazily-imported module, so that call now loads the body it reads from.
 *
 * `jsonSchema()` lets a doc render a JSON Schema file as a type table. It is
 * carried over from the Next.js configuration unchanged.
 */
export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    async: true,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
})

export default defineConfig({
  plugins: [jsonSchema()],
})

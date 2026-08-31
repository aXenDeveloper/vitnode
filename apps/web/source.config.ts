import { defineConfig, defineDocs } from 'fumadocs-mdx/config'
import jsonSchema from 'fumadocs-mdx/plugins/json-schema'

/**
 * The documentation collection, and the two capabilities the site is built on.
 *
 * `dir` is this application's own `content/docs`. Nothing here reads from
 * `apps/web`: Stage 16 copied the source across, and `apps/web` owns it from
 * now on - see `src/tests/docs-source.test.ts`, which fails if a docs file ever
 * points a reader back at the directory Stage 17 deletes.
 *
 * `includeProcessedMarkdown` keeps the rendered Markdown of every page next to
 * its compiled component, which is what `/llms-full.txt` is made of. Without it
 * `page.data.getText("processed")` has nothing to return and the LLM output is
 * empty rather than missing.
 *
 * `jsonSchema()` lets a doc render a JSON Schema file as a type table. It is
 * carried over from the Next.js configuration unchanged.
 */
export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
})

export default defineConfig({
  plugins: [jsonSchema()],
})

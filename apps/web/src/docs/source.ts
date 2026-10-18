import { defineDocs } from 'fumadocs-mdx/macro'

import { docsPageSchema } from './implementation/schema'

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    async: true,
    postprocess: {
      includeProcessedMarkdown: true,
    },
    schema: docsPageSchema,
  },
})

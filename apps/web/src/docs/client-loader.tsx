import browserCollections from 'collections/browser'

import type { DocsArticleMeta } from './article'

import { DocsArticle } from './article'
import { mdxComponents } from './mdx-components'

export const docsClientLoader = browserCollections.docs.createClientLoader({
  id: 'vitnode-docs',
  component: ({ default: MDX, toc }, props: DocsArticleMeta) => (
    <DocsArticle {...props} toc={toc}>
      <MDX components={mdxComponents} />
    </DocsArticle>
  ),
})

import type { TOCItemType } from 'fumadocs-core/toc'

import { DocsBody, DocsPage } from 'fumadocs-ui/page'

import { ViewOptions } from './view-options'

/** Everything about a document that is not its body. */
export interface DocsArticleMeta {
  description?: string
  full: boolean
  githubUrl: string
  title: string
  url: string
}

export const DocsArticle = ({
  children,
  description,
  full,
  githubUrl,
  title,
  toc,
  url,
}: DocsArticleMeta & {
  children: React.ReactNode
  toc: TOCItemType[]
}) => {
  return (
    <DocsPage
      full={full}
      tableOfContent={{ single: false, style: 'clerk' }}
      toc={toc}
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-foreground text-3xl font-bold text-balance sm:text-4xl">
            {title}
          </h1>

          <ViewOptions githubUrl={githubUrl} markdownUrl={url} />
        </div>

        {description ? (
          <p className="text-muted-foreground text-lg leading-relaxed text-pretty">
            {description}
          </p>
        ) : null}
      </div>

      <DocsBody>{children}</DocsBody>
    </DocsPage>
  )
}

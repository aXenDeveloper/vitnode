import type { TOCItemType } from 'fumadocs-core/toc'

import { Callout } from 'fumadocs-ui/components/callout'
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

/**
 * What a documentation page looks like: the heading, the "Open in" menu, the
 * table of contents, and the body.
 *
 * Presentation only, and that is what makes the split worth having. The body
 * arrives as `children` and the table of contents as a prop, so this module
 * knows nothing about how either was loaded - `./client-loader` is the half that
 * does, and it renders this.
 *
 * ## Why the table of contents is a prop rather than loader data
 *
 * Because it cannot cross a server function. A `TOCItemType`'s `title` is a
 * `ReactNode`, so a heading containing inline code or a link is a React element,
 * and TanStack Start's serializer rejects those by design - correctly, and at
 * compile time. It does not need to cross: the compiled MDX module exports its
 * own `toc` beside its component, so the table of contents arrives in the same
 * chunk as the body it describes.
 *
 * `tableOfContent` keeps the Next.js application's settings verbatim - the
 * "clerk" style, with `single: false` so a heading's children stay visible while
 * you read it.
 */
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
  const isPluginFirstGuide =
    url.startsWith('/docs/dev/') && !url.startsWith('/docs/dev/plugins')

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

      {isPluginFirstGuide ? (
        <Callout title="Plugin first" type="idea">
          Building a page, API, AdminCP screen, or feature? Put it in a plugin.
          Keep the host for composition and site-wide infrastructure; otherwise
          it becomes a very expensive junk drawer.{' '}
          <a href="/docs/dev/plugins/create">Create a plugin first.</a>
        </Callout>
      ) : null}

      <DocsBody>{children}</DocsBody>
    </DocsPage>
  )
}

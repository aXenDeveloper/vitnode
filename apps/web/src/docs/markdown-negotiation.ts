import { redirect } from '@tanstack/react-router'
import { createMiddleware } from '@tanstack/react-start'
import { isMarkdownPreferred } from 'fumadocs-core/negotiation'

import { DOCS_ROUTE, DOCS_SEARCH_PATH, encodeMarkdownUrl } from './shared'

const isDocsPagePathname = (pathname: string): boolean =>
  (pathname === DOCS_ROUTE || pathname.startsWith(`${DOCS_ROUTE}/`)) &&
  pathname !== DOCS_SEARCH_PATH &&
  !pathname.endsWith('.md')

export const markdownNegotiationMiddleware = createMiddleware().server(
  async ({ handlerType, next, request }) => {
    const url = new URL(request.url)

    if (
      handlerType !== 'router' ||
      !isDocsPagePathname(url.pathname) ||
      !isMarkdownPreferred(request)
    ) {
      return await next()
    }

    const slugs = url.pathname
      .slice(DOCS_ROUTE.length)
      .split('/')
      .filter(Boolean)
    url.pathname = encodeMarkdownUrl(slugs)

    // oxlint-disable-next-line typescript/only-throw-error
    throw redirect({ headers: { Vary: 'Accept' }, href: url.href })
  },
)

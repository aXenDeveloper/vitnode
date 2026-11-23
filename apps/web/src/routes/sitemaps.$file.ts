import { createFileRoute } from '@tanstack/react-router'
import { sitemapFileHandler } from '@vitnode/core/tanstack/seo/server'

export const Route = createFileRoute('/sitemaps/$file')({
  server: { handlers: { GET: sitemapFileHandler } },
})

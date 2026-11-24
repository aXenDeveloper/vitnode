import '@tanstack/react-start/server-only'
import { buildServerConfig } from '@vitnode/core/vitnode.config'

import { appMessages } from '@/locales/app'
import { packageMessages } from '@/package-messages.gen'
import { PRERENDERED_PATHS } from '@/site/prerender'
import { vitNodeConfig } from '@/vitnode.config'

const PRODUCTION_ORIGIN = 'https://vitnode.com'

// Only the production deployment is indexable. Previews, local builds and any
// other origin answer `noindex`. `VITNODE_WEB_URL` is set for both the build
// and the Worker, so prerendered pages and server renders agree.
const isProduction = (): boolean => {
  try {
    return (
      new URL(process.env.VITNODE_WEB_URL ?? '').origin === PRODUCTION_ORIGIN
    )
  } catch {
    return false
  }
}

export const vitNodeServerConfig = buildServerConfig({
  config: vitNodeConfig,
  messages: appMessages,
  packageMessages,
  seo: {
    indexing: isProduction(),
    sitemap: { paths: PRERENDERED_PATHS },
  },
})

import { blogApiPlugin } from '@vitnode/blog/config.api'
import { coreRelations } from '@vitnode/core/database/relations'
import { buildApiConfig } from '@vitnode/core/vitnode.config'
import { exampleApiPlugin } from '@vitnode/example/config.api'
import { SupabaseStorageAdapter } from '@vitnode/supabase-storage'
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'

import { appMessages } from './locales/app'
import { vitNodeConfig } from './vitnode.config'

config({ quiet: true })

export const POSTGRES_URL =
  process.env.POSTGRES_URL ?? 'postgresql://root:root@localhost:5432/vitnode'

/**
 * The API this app serves at `/api/*`, identical in shape to the config
 * `apps/api` builds. Nothing here is TanStack-specific: the Hono application is
 * unchanged, only the runtime that hands it requests is.
 *
 * Left out on purpose, because each one is a deployment decision rather than
 * part of the mount: `email`, `storage`, `ai`, `cron` and the SSO adapters. Add
 * them exactly as `apps/api/src/vitnode.api.config.ts` does when this app needs
 * them - `buildApiConfig` treats all of them as optional.
 */
export const vitNodeApiConfig = buildApiConfig({
  plugins: [blogApiPlugin(), exampleApiPlugin()],
  storage: {
    image: {
      quality: 85,
    },
    adapter: SupabaseStorageAdapter({
      url: process.env.SUPABASE_URL,
      secretKey: process.env.SUPABASE_SECRET_KEY,
      bucket: process.env.SUPABASE_STORAGE_BUCKET,
    }),
  },
  /**
   * The shared locale list, plus this app's own translations - the same files
   * `vitnode.server.config.ts` registers for the frontend. Each one holds a
   * package's web and email strings together, so the two runtimes read one
   * file and the email half cannot drift from the UI half.
   */
  i18n: { ...vitNodeConfig.i18n, messages: appMessages },
  dbProvider: drizzle({
    connection: POSTGRES_URL,
    relations: coreRelations,
  }),
  redis: process.env.REDIS_URL
    ? { url: process.env.REDIS_URL, password: process.env.REDIS_PASSWORD }
    : undefined,
  metadata: {
    title: 'VitNode API',
    shortTitle: 'VitNode',
  },
})

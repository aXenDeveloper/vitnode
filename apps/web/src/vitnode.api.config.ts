import { blogApiPlugin } from '@vitnode/blog/config.api'
import { coreRelations } from '@vitnode/core/database/relations'
import { buildApiConfig } from '@vitnode/core/vitnode.config'
import { exampleApiPlugin } from '@vitnode/example/config.api'
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'

// Vite's own `loadEnv` populates `process.env` at config time, which covers
// `vite dev` and `vite build` but not `node .output/server/index.mjs`. dotenv
// covers the production server too, the same way `apps/api` does it.
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

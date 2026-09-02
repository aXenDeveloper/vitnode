import { blogApiPlugin } from '@vitnode/blog/config.api'
import { coreRelations } from '@vitnode/core/database/relations'
import { buildApiConfig } from '@vitnode/core/vitnode.config'
import { exampleApiPlugin } from '@vitnode/example/config.api'
import { SupabaseStorageAdapter } from '@vitnode/supabase-storage'
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'

import { i18n } from './i18n'

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
/**
 * How many reverse proxies stand in front of this app, from `TRUST_PROXY`.
 *
 * Unset means none, and the client address is then the socket's - the only one a
 * caller cannot choose. Behind nginx, Traefik, Cloudflare or a platform edge,
 * set `TRUST_PROXY=1` (or the real hop count) so `X-Forwarded-For` is read
 * instead; otherwise every visitor shares one rate-limit bucket and the audit
 * trail records the proxy.
 */
const trustProxy = process.env.TRUST_PROXY
  ? Number(process.env.TRUST_PROXY)
  : undefined

export const vitNodeApiConfig = buildApiConfig({
  plugins: [blogApiPlugin(), exampleApiPlugin()],
  storage: {
    // Zero-config: writes to `public/uploads` and serves via Hono static files.
    // adapter: LocalStorageAdapter(),
    // Re-encode uploaded images with sharp to shrink them before storing.
    image: {
      quality: 85,
    },
    // adapter: S3StorageAdapter({
    //   bucket: process.env.S3_BUCKET,
    //   region: process.env.S3_REGION,
    //   accessKeyId: process.env.S3_ACCESS_KEY_ID,
    //   secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    //   endpoint: process.env.S3_ENDPOINT, // Cloudflare R2 endpoint
    //   publicUrl: process.env.S3_PUBLIC_URL,
    // }),
    adapter: SupabaseStorageAdapter({
      url: process.env.SUPABASE_URL,
      secretKey: process.env.SUPABASE_SECRET_KEY,
      bucket: process.env.SUPABASE_STORAGE_BUCKET,
    }),
  },
  /**
   * The same locale declaration `vitnode.shell.config.ts` spreads into
   * `buildConfig`, because this app serves the site and the API from one
   * process: `src/i18n.ts` is the installation's one statement of which
   * languages exist, and both configs read it rather than each carrying a list
   * that agrees until it doesn't.
   *
   * It is also what a database bootstrap seeds `core_languages` from. This app
   * delegates that to `apps/api` (see the `dev` script), so the list here is not
   * what runs in this repository - but it is what runs in a generated single
   * app, which owns its own schema, and it is what this app's emails and
   * `c.get("i18n")` render in either case.
   */
  i18n,
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
  // This mount has no socket to read: the bridge hands Hono a bare `Request`,
  // so without this every caller resolves to the same fallback address and the
  // rate limiter degrades to one bucket for the whole site. The API warns at
  // boot when that is happening.
  trustProxy,
})

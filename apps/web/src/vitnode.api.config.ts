import { blogApiPlugin } from '@vitnode/blog/config.api'
import { FakePaymentAdapter } from '@vitnode/core/api/adapters/payments/fake'
import { scopedDatabase } from '@vitnode/core/cloudflare/database'
import { coreRelations } from '@vitnode/core/database/relations'
import { buildApiConfig } from '@vitnode/core/vitnode.config'
import { forumApiPlugin } from '@vitnode/forum/config.api'
import { StripePaymentAdapter } from '@vitnode/stripe'
import { SupabaseStorageAdapter } from '@vitnode/supabase-storage'
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'
import { newsroomApiPlugin } from 'newsroom/config.api'
import { paymentsDemoApiPlugin } from 'payments-demo/config.api'

import { contentModules } from './content-modules.gen'
import { appMessages } from './locales/app'
import { frontendPlugins } from './plugin-inventory.gen'
import { vitNodeConfig } from './vitnode.config'

config({ quiet: true })

/** `pnpm build:cloudflare`: the API runs inside a Cloudflare Worker. */
const ON_WORKERS = globalThis.navigator?.userAgent === 'Cloudflare-Workers'

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
  plugins: [
    blogApiPlugin(),
    forumApiPlugin(),
    newsroomApiPlugin(),
    paymentsDemoApiPlugin(),
  ],
  contentModules,
  frontendPlugins,
  storage: {
    // Re-encoding needs sharp, a native module Workers cannot load: there,
    // images are stored as uploaded.
    image: ON_WORKERS ? undefined : { quality: 85 },
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
  authorization: {
    passkeys: true,
  },
  payments: {
    providers: [
      ...(process.env.STRIPE_SECRET_KEY
        ? [
            StripePaymentAdapter({
              id: 'stripe-main',
              secretKey: process.env.STRIPE_SECRET_KEY,
              webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
            }),
          ]
        : []),
      ...(process.env.NODE_ENV !== 'production' &&
      process.env.PAYMENTS_FAKE_WEBHOOK_SECRET
        ? [
            FakePaymentAdapter({
              id: 'fake-test',
              webhookSecret: process.env.PAYMENTS_FAKE_WEBHOOK_SECRET,
            }),
          ]
        : []),
    ],
  },
  // One client per process on Node. On Workers a request cannot reuse a
  // connection another request opened, so it gets its own, and the realtime
  // hub closes its client when idle so it can hibernate.
  dbProvider: scopedDatabase(() =>
    drizzle({
      connection: {
        url: POSTGRES_URL,
        ...(ON_WORKERS ? { max: 1 } : {}),
        onnotice: () => undefined,
      },
      relations: coreRelations,
    }),
  ),
  // Leave REDIS_URL unset on Workers: the realtime hub owns every socket, and
  // the cache falls back to each isolate's memory.
  redis: process.env.REDIS_URL
    ? { url: process.env.REDIS_URL, password: process.env.REDIS_PASSWORD }
    : undefined,
  metadata: {
    title: 'VitNode API',
    shortTitle: 'VitNode',
  },
})

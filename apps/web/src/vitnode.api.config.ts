import { blogApiPlugin } from '@vitnode/blog/config.api'
import { coreRelations } from '@vitnode/core/database/relations'
import { buildApiConfig } from '@vitnode/core/vitnode.config'
import { exampleApiPlugin } from '@vitnode/example/config.api'
import { NodeCronAdapter } from '@vitnode/node-cron'
import { StripePaymentProvider } from '@vitnode/stripe'
import { SupabaseStorageAdapter } from '@vitnode/supabase-storage'
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'

import { contentModules } from './content-modules.gen'
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
 * part of the mount: `email`, `ai` and the SSO adapters. Add them exactly as
 * `apps/api/src/vitnode.api.config.ts` does when this app needs them -
 * `buildApiConfig` treats all of them as optional.
 *
 * `cron` is opt-in: a long-running Node server (`pnpm dev`, `pnpm start`) can
 * tick the queue itself with `VITNODE_CRON=node`. Serverless hosts cannot hold
 * a timer, so they leave it off and call `POST /api/@vitnode/core/cron` from a
 * scheduler instead - without one of the two, queued work such as payment
 * webhooks waits forever.
 */
export const vitNodeApiConfig = buildApiConfig({
  plugins: [blogApiPlugin(), exampleApiPlugin()],
  contentModules,
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
  authorization: {
    passkeys: true,
  },
  dbProvider: drizzle({
    connection: POSTGRES_URL,
    relations: coreRelations,
  }),
  cron: process.env.VITNODE_CRON === 'node' ? NodeCronAdapter() : undefined,
  // Off unless Stripe test keys are in `.env` - see `.env.example`.
  payments: process.env.STRIPE_SECRET_KEY
    ? {
        defaultCurrency: 'PLN',
        currencies: {
          PLN: { currencyDisplay: 'code' },
          USD: { currencyDisplay: 'symbol' },
          EUR: { currencyDisplay: 'symbol' },
        },
        providers: [
          StripePaymentProvider({
            secretKey: process.env.STRIPE_SECRET_KEY,
            webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
          }),
        ],
      }
    : undefined,
  redis: process.env.REDIS_URL
    ? { url: process.env.REDIS_URL, password: process.env.REDIS_PASSWORD }
    : undefined,
  metadata: {
    title: 'VitNode API',
    shortTitle: 'VitNode',
  },
})

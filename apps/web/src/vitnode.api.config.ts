import { blogApiPlugin } from '@vitnode/blog/config.api'
import { coreRelations } from '@vitnode/core/database/relations'
import { buildApiConfig } from '@vitnode/core/vitnode.config'
import { exampleApiPlugin } from '@vitnode/example/config.api'
import { SupabaseStorageAdapter } from '@vitnode/supabase-storage'
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'

import { vitNodeConfig } from './vitnode.config'

config({ quiet: true })

export const POSTGRES_URL =
  process.env.POSTGRES_URL ?? 'postgresql://root:root@localhost:5432/vitnode'

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
  i18n: vitNodeConfig.i18n,
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

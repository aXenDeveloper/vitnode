import { google } from "@ai-sdk/google";
import { blogApiPlugin } from "@vitnode/blog/config.api";
import { coreRelations } from "@vitnode/core/database/relations";
// import { LocalStorageAdapter } from "@vitnode/core/api/adapters/storage/local";
import { buildApiConfig } from "@vitnode/core/vitnode.config";
import { exampleApiPlugin } from "@vitnode/example/config.api";
import { NodeCronAdapter } from "@vitnode/node-cron";
import { NodemailerEmailAdapter } from "@vitnode/nodemailer";
// import { S3StorageAdapter } from "@vitnode/s3";
import { SupabaseStorageAdapter } from "@vitnode/supabase-storage";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";

config({
  quiet: true,
});

export const POSTGRES_URL =
  process.env.POSTGRES_URL ?? "postgresql://root:root@localhost:5432/vitnode";

export const vitNodeApiConfig = buildApiConfig({
  plugins: [blogApiPlugin(), exampleApiPlugin()],
  ai: {
    models: [
      {
        id: "default",
        name: "Claude Sonnet 5",
        model: "anthropic/claude-sonnet-5",
      },
      {
        id: "fast",
        name: "Google Gemini 3.5 Flash Lite",
        model: google("gemini-3.5-flash-lite"),
      },
    ],
    embeddingModels: [
      {
        id: "default",
        name: "OpenAI text-embedding-3-small",
        model: "openai/text-embedding-3-small",
      },
    ],
  },
  // No `i18n` block: the languages `@vitnode/core` and the installed plugins
  // ship are picked up on their own. Add one to declare extra locales or to
  // override strings from `src/locales/<pluginId>/<locale>.json`.
  dbProvider: drizzle({
    connection: POSTGRES_URL,
    relations: coreRelations,
  }),
  cron: NodeCronAdapter(),
  redis: process.env.REDIS_URL
    ? { url: process.env.REDIS_URL, password: process.env.REDIS_PASSWORD }
    : undefined,
  email: {
    adapter: NodemailerEmailAdapter({
      from: process.env.NODE_MAILER_FROM,
      host: process.env.NODE_MAILER_HOST,
      password: process.env.NODE_MAILER_PASSWORD,
      user: process.env.NOD_EMAILER_USER,
    }),
    logo: {
      text: "VitNode Email Test",
      src: "http://localhost:3000/logo_vitnode_dark.png",
    },
  },
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
  metadata: {
    title: "VitNode API",
    shortTitle: "VitNode",
  },
});

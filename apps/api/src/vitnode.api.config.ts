import { google } from "@ai-sdk/google";
import { blogApiPlugin } from "@vitnode/blog/config.api";
import { DiscordSSOApiPlugin } from "@vitnode/core/api/adapters/sso/discord";
import { FacebookSSOApiPlugin } from "@vitnode/core/api/adapters/sso/facebook";
import { GoogleSSOApiPlugin } from "@vitnode/core/api/adapters/sso/google";
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
      // Served by the web app, not by this one. Stage 17 moved the file from
      // `apps/docs/public` (which answered on 3000) to `apps/web/public`, and
      // `vite dev --port 3000` is where that is reachable.
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
  /**
   * Sign-in with Discord, Google and Facebook.
   *
   * Carried over from `apps/docs` when Stage 17 deleted it: that application's
   * config was the only place in the repo registering these three adapters, and
   * `@vitnode/core/api/adapters/sso/*` would otherwise have had no consumer at
   * all - implementations behind a live route (`/login/sso/:providerId`) with
   * nothing showing how to switch them on.
   *
   * Registering one with its environment variables unset is safe and is the
   * normal state here: each adapter defaults `clientId`/`clientSecret` to `""`
   * and only fails when somebody actually tries that provider, with "Missing
   * Discord client ID or secret" rather than a broken login page. So the list is
   * what this API *supports*; the environment decides what works.
   */
  authorization: {
    ssoAdapters: [
      DiscordSSOApiPlugin({
        clientId: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
      }),
      GoogleSSOApiPlugin({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      }),
      FacebookSSOApiPlugin({
        clientId: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      }),
    ],
  },
  // Bot protection on the routes that declare `withCaptcha` - register, log in,
  // reset password. Also carried over from `apps/docs`, and left commented for a
  // reason worth knowing before uncommenting: unlike the SSO adapters above,
  // this one is *not* inert without its keys. Present-but-unconfigured means
  // every one of those routes posts `secret: undefined` to Cloudflare, gets
  // `success: false` back, and rejects the request - so switching it on without
  // setting both keys locks people out of registration rather than degrading.
  //
  // captcha: {
  //   type: "cloudflare_turnstile",
  //   siteKey: process.env.CLOUDFLARE_TURNSTILE_SITE_KEY,
  //   secretKey: process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY,
  // },
  //
  // And the rate limit `apps/docs` ran with. Sensible in production, and left
  // off here because 20 requests a minute is easy to hit by hand while
  // developing against this API.
  //
  // rateLimiter: {
  //   points: 20, // 20 requests
  //   duration: 60, // per 60 seconds
  // },
  metadata: {
    title: "VitNode API",
    shortTitle: "VitNode",
  },
});

import { blogApiPlugin } from "@vitnode/blog/config.api";
import { DiscordSSOApiAdapter } from "@vitnode/core/api/adapters/sso/discord";
// import { ResendEmailAdapter } from "@vitnode/resend";
import { FacebookSSOApiAdapter } from "@vitnode/core/api/adapters/sso/facebook";
import { GoogleSSOApiAdapter } from "@vitnode/core/api/adapters/sso/google";
import { buildApiConfig } from "@vitnode/core/vitnode.config";
import { NodeCronAdapter } from "@vitnode/node-cron";
import { NodemailerEmailAdapter } from "@vitnode/nodemailer";
import { drizzle } from "drizzle-orm/postgres-js";

export const POSTGRES_URL =
  process.env.POSTGRES_URL ?? "postgresql://root:root@localhost:5432/vitnode";

export const vitNodeApiConfig = buildApiConfig({
  pathToMessages: async path => await import(`./locales/${path}`),
  captcha: {
    type: "cloudflare_turnstile",
    siteKey: process.env.CLOUDFLARE_TURNSTILE_SITE_KEY,
    secretKey: process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY,
  },
  metadata: {
    title: "VitNode API",
    shortTitle: "VitNode",
  },
  plugins: [blogApiPlugin()],
  dbProvider: drizzle({
    connection: POSTGRES_URL,
    casing: "camelCase",
  }),
  cronAdapter: NodeCronAdapter(),
  rateLimiter: {
    points: 20, // 20 requests
    duration: 60, // per 60 seconds
  },
  email: {
    adapter: NodemailerEmailAdapter({
      from: process.env.NODE_MAILER_FROM,
      host: process.env.NODE_MAILER_HOST,
      password: process.env.NODE_MAILER_PASSWORD,
      user: process.env.NOD_EMAILER_USER,
    }),
    // adapter: ResendEmailAdapter({
    //   apiKey: process.env.RESEND_API_KEY,
    //   from: process.env.RESEND_FROM_EMAIL,
    // }),
    logo: {
      text: "VitNode Email Test",
      src: "http://localhost:3000/logo_vitnode_dark.png",
    },
  },
  authorization: {
    ssoAdapters: [
      DiscordSSOApiAdapter({
        clientId: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
      }),
      GoogleSSOApiAdapter({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      }),
      FacebookSSOApiAdapter({
        clientId: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      }),
    ],
  },
});

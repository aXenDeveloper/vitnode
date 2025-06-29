import { blogApiPlugin } from '@vitnode/blog/config.api';
import { NodemailerEmailAdapter } from '@vitnode/core/api/adapters/email/nodemailer';
import { DiscordSSOApiPlugin } from '@vitnode/core/api/adapters/sso/discord';
import { FacebookSSOApiPlugin } from '@vitnode/core/api/adapters/sso/facebook';
import { GoogleSSOApiPlugin } from '@vitnode/core/api/adapters/sso/google';
import { buildApiConfig } from '@vitnode/core/vitnode.config';
import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { join } from 'path';

dotenv.config({
  path: join(process.cwd(), '..', '..', '.env'),
});

export const POSTGRES_URL =
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  process.env.POSTGRES_URL || 'postgresql://root:root@localhost:5432/vitnode';

export const vitNodeApiConfig = buildApiConfig({
  captcha: {
    type: 'recaptcha_v3',
    siteKey: process.env.RECAPTCHA_SITE_KEY_v3,
    secretKey: process.env.RECAPTCHA_SECRET_KEY_v3,
  },
  plugins: [blogApiPlugin()],
  dbProvider: drizzle({
    connection: POSTGRES_URL,
    casing: 'camelCase',
  }),
  rateLimiter: {
    points: 20, // 20 requests
    duration: 60, // per 60 seconds
  },
  emailAdapter: NodemailerEmailAdapter({
    from: process.env.NODE_MAILER_FROM,
    host: process.env.NODE_MAILER_HOST,
    password: process.env.NODE_MAILER_PASSWORD,
    user: process.env.NOD_EMAILER_USER,
  }),
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
});

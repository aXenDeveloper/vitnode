import { blogApiPlugin } from '@vitnode/blog/config.api';
import { NodemailerEmailPlugin } from '@vitnode/core/api/plugins/email/nodemailer';
import { DiscordSSOApiPlugin } from '@vitnode/core/api/plugins/sso/discord';
import { FacebookSSOApiPlugin } from '@vitnode/core/api/plugins/sso/facebook';
import { GoogleSSOApiPlugin } from '@vitnode/core/api/plugins/sso/google';
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
  plugins: [blogApiPlugin()],
  dbProvider: drizzle({
    connection: POSTGRES_URL,
    casing: 'camelCase',
  }),
  // emailProvider: NodemailerEmailPlugin({
  //   from: process.env.NODE_MAILER_FROM,
  //   host: process.env.NODE_MAILER_HOST,
  //   password: process.env.NODE_MAILER_PASSWORD,
  //   user: process.env.NOD_EMAILER_USER,
  // }),
  authorization: {
    ssoProviders: [
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

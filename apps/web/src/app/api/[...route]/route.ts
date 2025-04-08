import { OpenAPIHono } from '@hono/zod-openapi';
import { handle } from 'hono/vercel';
import { VitNodeAPI } from 'vitnode/api/config';
import { NodemailerEmailPlugin } from 'vitnode/api/plugins/email/nodemailer';
// import { ResendEmailPlugin } from 'vitnode/api/plugins/email/resend';
import { DiscordSSOApiPlugin } from 'vitnode/api/plugins/sso/discord';
import { FacebookSSOApiPlugin } from 'vitnode/api/plugins/sso/facebook';
import { GoogleSSOApiPlugin } from 'vitnode/api/plugins/sso/google';

const app = new OpenAPIHono().basePath('/api');
VitNodeAPI({
  app,
  plugins: [],
  site: {
    name: 'VitNode',
  },
  // emailProvider: ResendEmailPlugin({
  //   apiKey: process.env.RESEND_API_KEY ?? '',
  //   from: process.env.RESEND_FROM ?? '',
  // }),
  emailProvider: NodemailerEmailPlugin({
    from: process.env.NODE_MAILER_FROM,
    host: process.env.NODE_MAILER_HOST,
    password: process.env.NODE_MAILER_PASSWORD,
    user: process.env.NOD_EMAILER_USER,
  }),
  authorization: {
    ssoPlugins: [
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

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);

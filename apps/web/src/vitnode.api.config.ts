import { blogApiPlugin } from 'vitnode-blog/plugin.config';
import { NodemailerEmailPlugin } from 'vitnode/api/plugins/email/nodemailer';
import { DiscordSSOApiPlugin } from 'vitnode/api/plugins/sso/discord';
import { FacebookSSOApiPlugin } from 'vitnode/api/plugins/sso/facebook';
import { GoogleSSOApiPlugin } from 'vitnode/api/plugins/sso/google';
import { buildApiConfig } from 'vitnode/vitnode.config';

export const vitNodeApiConfig = buildApiConfig({
  plugins: [blogApiPlugin()],
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

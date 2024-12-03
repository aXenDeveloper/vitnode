import { Module } from '@nestjs/common';
import { emailResend } from 'vitnode-backend-email-resend';
import { VitNodeCoreModule } from 'vitnode-backend/app.module';
// import { emailSMTP } from 'vitnode-backend-email-smtp';
// import { aiGoogle } from 'vitnode-backend-ai-google';
// import { aiOpenAi } from 'vitnode-backend-ai-open-ai';

import { DATABASE_ENVS, schemaDatabase } from './database/config';
import { DatabaseModule } from './database/database.module';
import { PluginsModule } from './plugins/plugins.module';

@Module({
  imports: [
    VitNodeCoreModule.register({
      database: {
        config: DATABASE_ENVS,
        schemaDatabase,
      },
      ssoLoginMethod: [
        {
          name: 'Google',
          code: 'google',
          getUrl: ({ redirect_uri, client_id }) => {
            const params = new URLSearchParams({
              client_id,
              redirect_uri,
              response_type: 'code',
              scope: 'openid profile email',
            });

            return {
              url: `https://accounts.google.com/o/oauth2/auth?${params}`,
            };
          },
          callback: async ({
            client_id,
            client_secret,
            code,
            redirect_uri,
          }) => {
            const res = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                client_id,
                client_secret,
                code,
                redirect_uri,
                grant_type: 'authorization_code',
              }),
            });

            return await res.json();
          },
          registerCallback: async ({ access_token }) => {
            const res = await fetch(
              'https://www.googleapis.com/oauth2/v1/userinfo',
              {
                headers: {
                  Authorization: `Bearer ${access_token}`,
                },
              },
            );
            const data = await res.json();

            return {
              email: data.email,
              id: data.id,
              name: data.name,
              verified_email: data.verified_email,
            };
          },
        },
      ],
      email: emailResend({
        api_key: process.env.EMAIL_RESEND_API_KEY,
        from: process.env.EMAIL_RESEND_FROM,
      }),
      // email: emailSMTP({
      //   host: process.env.EMAIL_SMTP_HOST,
      //   port: process.env.EMAIL_SMTP_PORT,
      //   secure: process.env.EMAIL_SMTP_SECURE === 'true',
      //   user: process.env.EMAIL_SMTP_USER,
      //   password: process.env.EMAIL_SMTP_PASSWORD,
      //   from: process.env.EMAIL_SMTP_FROM,
      // }),
      // ai: aiGoogle({
      //   api_key: process.env.AI_GOOGLE_API_KEY,
      //   model: 'gemini-1.0-pro',
      // }),
      // ai: aiOpenAi({
      //   api_key: process.env.AI_OPENAI_API_KEY,
      //   model: 'gpt-4-turbo',
      // }),
    }),
    DatabaseModule,
    PluginsModule,
  ],
})
export class AppModule {}

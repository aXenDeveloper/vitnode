import { createGoogleGenerativeAI } from '@ai-sdk/google';
// import { emailSMTP } from 'vitnode-backend-email-smtp';
// import { emailResend } from 'vitnode-backend-email-resend';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { VitNodeCoreModule } from 'vitnode-backend/app.module';

import { DATABASE_ENVS, schemaDatabase } from './database/config';
import { DatabaseModule } from './database/database.module';
import { PluginsModule } from './plugins/plugins.module';

const google = createGoogleGenerativeAI({
  apiKey: process.env.AI_MODEL_API_KEY,
});

@Module({
  imports: [
    VitNodeCoreModule.register({
      database: {
        config: DATABASE_ENVS,
        schemaDatabase,
      },
      ai: google('gemini-1.5-pro'),
      // captcha: {
      //   type: 'cloudflare_turnstile',
      //   secret_key: '',
      //   site_key: '',
      // },
      // email: emailResend({
      //   api_key: process.env.EMAIL_RESEND_API_KEY,
      //   from: process.env.EMAIL_RESEND_FROM,
      // }),
      // email: emailSMTP({
      //   host: process.env.EMAIL_SMTP_HOST,
      //   port: process.env.EMAIL_SMTP_PORT,
      //   secure: process.env.EMAIL_SMTP_SECURE === 'true',
      //   user: process.env.EMAIL_SMTP_USER,
      //   password: process.env.EMAIL_SMTP_PASSWORD,
      //   from: process.env.EMAIL_SMTP_FROM,
      // }),
    }),
    DatabaseModule,
    PluginsModule,
    CacheModule.register({
      isGlobal: true,
    }),
  ],
})
export class AppModule {}

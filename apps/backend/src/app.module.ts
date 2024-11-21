import { Module } from '@nestjs/common';
import { VitNodeCoreModule } from 'vitnode-backend/app.module';
// import { emailResend } from 'vitnode-backend-email-resend';
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

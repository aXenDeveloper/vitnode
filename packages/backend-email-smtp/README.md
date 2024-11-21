# (Vitnode) Backend SMTP Email Provider

This package is used to create a provider for send emails using SMTP into the VitNode app.

<p align="center">
  <br>
  <a href="https://vitnode.com/" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/logo/vitnode_logo_dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/logo/vitnode_logo_light.svg">
      <img alt="VitNode Logo" src="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/logo/vitnode_logo_light.svg" width="400">
    </picture>
  </a>
  <br>
  <br>
</p>

## Installation

```bash tab="pnpm"
pnpm i vitnode-backend-email-smtp --filter backend
```

or

```bash tab="npm"
npn i vitnode-backend-email-smtp --workspace=backend
```

### .env file

Add the following to your `.env` file:

```env
EMAIL_SMTP_HOST={your_host}
EMAIL_SMTP_PORT={your_port}
EMAIL_SMTP_SECURE={true/false}
EMAIL_SMTP_USER={your_user}
EMAIL_SMTP_FROM={your_from_email}
EMAIL_SMTP_PASSWORD={your_password}
```

### Provide config

Provide `emailSMTP` to `VitNodeCoreModule`:

```ts title="apps/backend/src/app.module.ts"
import { Module } from '@nestjs/common';
import { VitNodeCoreModule } from 'vitnode-backend';
import { emailSMTP } from 'vitnode-backend-email-smtp';

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
      email: emailSMTP({
        host: process.env.EMAIL_SMTP_HOST,
        port: process.env.EMAIL_SMTP_PORT,
        secure: process.env.EMAIL_SMTP_SECURE === 'true',
        user: process.env.EMAIL_SMTP_USER,
        password: process.env.EMAIL_SMTP_PASSWORD,
        from: process.env.EMAIL_SMTP_FROM,
      }),
    }),
    DatabaseModule,
    PluginsModule,
  ],
})
export class AppModule {}
```

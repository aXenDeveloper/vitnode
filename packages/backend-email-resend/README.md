# (Vitnode) Backend Resend Email Provider

This package is used to create a provider for send emails using [Resend](https://resend.com/) into the VitNode app.

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
pnpm i vitnode-backend-email-resend --filter backend
```

or

```bash tab="npm"
npn i vitnode-backend-email-resend --workspace=backend
```

### .env file

Add the following to your `.env` file:

```env
EMAIL_RESEND_API_KEY={your_api_key}
EMAIL_RESEND_FROM={your_from_email}
```

### Provide config

Provide `emailResend` to `VitNodeCoreModule`:

```ts title="apps/backend/src/app.module.ts"
import { Module } from '@nestjs/common';
import { VitNodeCoreModule } from 'vitnode-backend';
import { emailResend } from 'vitnode-backend-email-resend';

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
      email: emailResend({
        api_key: process.env.EMAIL_RESEND_API_KEY,
        from: process.env.EMAIL_RESEND_FROM,
      }),
    }),
    DatabaseModule,
    PluginsModule,
  ],
})
export class AppModule {}
```

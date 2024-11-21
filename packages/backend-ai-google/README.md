# (Vitnode) Backend Google AI Provider

This package is used to create a provider for AI using [Google AI Dev](https://ai.google.dev/) into the VitNode app.

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
pnpm i backend-ai-google --filter backend
```

or

```bash tab="npm"
npn i backend-ai-google --workspace=backend
```

### .env file

Add the following to your `.env` file:

```env
AI_GOOGLE_API_KEY={your_api_key}
```

### Provide config

Provide `aiGoogle` to `VitNodeCoreModule` and chose the model you want to use:

```ts title="apps/backend/src/app.module.ts"
import { Module } from '@nestjs/common';
import { VitNodeCoreModule } from 'vitnode-backend';
import { aiGoogle } from 'vitnode-backend-ai-google';

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
      ai: aiGoogle({
        api_key: process.env.AI_GOOGLE_API_KEY,
        model: 'gemini-1.0-pro',
      }),
    }),
    DatabaseModule,
    PluginsModule,
  ],
})
export class AppModule {}
```

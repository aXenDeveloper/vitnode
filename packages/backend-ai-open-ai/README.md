# (Vitnode) Backend OpenAI Provider

This package is used to create a provider for AI using [OpenAI Platform](https://platform.openai.com/) into the VitNode app.

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
pnpm i backend-ai-open-ai --filter backend
```

or

```bash tab="npm"
npn i backend-ai-open-ai --workspace=backend
```

### .env file

Add the following to your `.env` file:

```env
AI_OPENAI_API_KEY={your_api_key}
```

### Provide config

Provide `aiOpenAi` to `VitNodeCoreModule` and chose the model you want to use:

```ts title="apps/backend/src/app.module.ts"
import { Module } from '@nestjs/common';
import { VitNodeCoreModule } from 'vitnode-backend';
import { aiOpenAi } from 'vitnode-backend-ai-open-ai';

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
      ai: aiOpenAi({
        api_key: process.env.AI_OPENAI_API_KEY,
        model: 'gpt-4-turbo',
      }),
    }),
    DatabaseModule,
    PluginsModule,
  ],
})
export class AppModule {}
```

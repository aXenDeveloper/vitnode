import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';

import { CoreModule } from './core/core.module';
import { EmailSenderFunction } from './helpers/email/email-helpers.type';
import { GlobalHelpersModule } from './helpers/helpers.module';
import {
  DatabaseModuleArgs,
  InternalDatabaseModule,
} from './utils/database/database.module';

const internalPaths = {
  backend: join(process.cwd(), 'src'),
  frontend: join(process.cwd(), '..', 'frontend', 'src'),
  uploads: join(process.cwd(), 'uploads'),
  plugins: join(process.cwd(), 'src', 'plugins'),
};

export const ABSOLUTE_PATHS = {
  plugins: internalPaths.plugins,
  uploads: {
    public: join(internalPaths.uploads, 'public'),
    private: join(internalPaths.uploads, 'private'),
    temp: join(internalPaths.uploads, 'temp'),
  },
  plugin: ({ code }: { code: string }) => ({
    root: join(internalPaths.plugins, code),
  }),
};

const parseFrontendUrlFromEnv = () => {
  const envUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;
  const frontendUrl = envUrl ? envUrl : 'http://localhost:3000';
  const urlObj = new URL(frontendUrl);

  return {
    url: frontendUrl,
    protocol: urlObj.protocol,
    hostname: urlObj.hostname,
    port: urlObj.port,
  };
};

const parseBackendUrlFromEnv = () => {
  const envUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  const frontendUrl = envUrl ? envUrl : 'http://localhost:8080';
  const urlObj = new URL(frontendUrl);

  return {
    url: frontendUrl,
    protocol: urlObj.protocol,
    hostname: urlObj.hostname,
    port: urlObj.port,
  };
};

const replaceUrlToDomain = (url: string) => {
  const urlObj = new URL(url);
  let hostname = urlObj.hostname;

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return hostname;
  }

  if (hostname.split('.').length > 2) {
    hostname = hostname.split('.').slice(1).join('.');
  }

  return hostname;
};

const config = () => {
  const frontend_url = parseFrontendUrlFromEnv();
  const backend_url = parseBackendUrlFromEnv();

  const data = {
    login_token_secret: process.env.LOGIN_TOKEN_SECRET ?? '',
    frontend_url: frontend_url.url,
    backend_url: backend_url.url,
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 8080,
    cookies: {
      domain: replaceUrlToDomain(frontend_url.url),
      secure: frontend_url.protocol === 'https:',
      login_token: {
        expiresIn: 3, // 3 days
        expiresInRemember: 90, // 90 days
        name: 'vitnode-login-token',
        user_id: 'vitnode-user-id',
        admin: {
          name: 'vitnode-login-token-admin',
          admin_id: 'vitnode-admin-id',
          expiresIn: 1, // 1 day
        },
      },
      known_device: {
        name: 'vitnode-device',
        expiresIn: 365, // 1 year
      },
    },
  };

  if (!data.login_token_secret) {
    throw new Error('`LOGIN_TOKEN_SECRET` is not defined in .env file');
  }

  return data;
};

@Module({})
export class VitNodeCoreModule {
  static register({
    pathToEnvFile,
    database,
    email,
  }: {
    database: DatabaseModuleArgs;
    email?: EmailSenderFunction;
    pathToEnvFile: string;
  }): DynamicModule {
    return {
      module: VitNodeCoreModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [config],
          envFilePath: pathToEnvFile,
        }),
        ScheduleModule.forRoot(),
        CoreModule,
        InternalDatabaseModule.register(database),
        GlobalHelpersModule.register({ email }),
      ],
    };
  }
}

import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LanguageModel } from 'ai';
import { join } from 'path';

import { CoreModule } from './core/core.module';
import { SSOAuthItem } from './helpers/auth/sso/sso.service';
import { CaptchaConfig } from './helpers/captcha.service';
import { EmailSenderFunction } from './helpers/email/email-helpers.type';
import { GlobalHelpersModule } from './helpers/helpers.module';
import {
  DatabaseModuleArgs,
  InternalDatabaseModule,
} from './utils/database/database.module';

const internalPaths = {
  backend: join(process.cwd(), 'src'),
  frontend: join(process.cwd(), '..', 'frontend', 'src'),
  frontend_root: join(process.cwd(), '..', 'frontend'),
  shared: join(process.cwd(), '..', 'shared', 'plugins'),
  uploads: join(process.cwd(), 'uploads'),
  plugins: join(process.cwd(), 'src', 'plugins'),
};

export const ABSOLUTE_PATHS = {
  backend: internalPaths.backend,
  frontend: internalPaths.frontend,
  frontend_root: internalPaths.frontend_root,
  plugins: internalPaths.plugins,
  uploads: {
    public: join(internalPaths.uploads, 'public'),
    temp: join(internalPaths.uploads, 'temp'),
  },
  plugin: ({ code }: { code: string }) => ({
    root: join(internalPaths.plugins, code),
    admin: join(internalPaths.plugins, code, 'admin'),
    config: join(internalPaths.plugins, code, 'config.json'),
    database: join(internalPaths.plugins, code, 'admin', 'database'),
    shared: join(internalPaths.shared, code),
    frontend: {
      plugin: join(internalPaths.frontend, 'plugins', code),
      templates: join(internalPaths.frontend, 'plugins', code, 'templates'),
      languages: join(internalPaths.frontend, 'plugins', code, 'langs'),
      default_page: join(
        internalPaths.frontend,
        'plugins',
        code,
        'templates',
        'default-page.tsx',
      ),
      admin_pages_auth: join(
        internalPaths.frontend,
        'app',
        '[locale]',
        'admin',
        '(auth)',
        code,
      ),
      admin_pages: join(
        internalPaths.frontend,
        'app',
        '[locale]',
        'admin',
        code,
      ),
      pages: join(internalPaths.frontend, 'app', '[locale]', code),
      pages_main: join(
        internalPaths.frontend,
        'app',
        '[locale]',
        '(main)',
        code,
      ),
      pages_main_layout: join(
        internalPaths.frontend,
        'app',
        '[locale]',
        '(main)',
        '(layout)',
        code,
      ),
      pages_root: join(internalPaths.frontend, 'app', code),
    },
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
  const envUrl = process.env.NEXT_PUBLIC_BACKEND_CLIENT_URL;
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
    dev_mode: process.env.NODE_ENV === 'development',
    cookies: {
      domain: replaceUrlToDomain(frontend_url.url),
      secure: frontend_url.protocol === 'https:',
      lang: 'NEXT_LOCALE',
      login_token: {
        expiresIn: 90, // 90 days
        name: 'vitnode-login-token',
        user_id: 'vitnode-user-id',
        admin: {
          name: 'vitnode-login-token-admin',
          admin_id: 'vitnode-admin-id',
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
    database,
    email,
    ssoLoginMethod,
    captcha,
    ai,
  }: {
    ai?: LanguageModel;
    captcha?: CaptchaConfig;
    database: DatabaseModuleArgs;
    email?: EmailSenderFunction;
    ssoLoginMethod?: SSOAuthItem[];
  }): DynamicModule {
    return {
      module: VitNodeCoreModule,
      providers: [
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
      ],
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [config],
        }),
        ScheduleModule.forRoot(),
        CoreModule,
        ThrottlerModule.forRoot([
          {
            ttl: 1000,
            limit: 60,
          },
        ]),
        InternalDatabaseModule.register(database),
        JwtModule.register({ global: true }),
        ServeStaticModule.forRoot({
          rootPath: ABSOLUTE_PATHS.uploads.public,
          serveRoot: '/public/',
          serveStaticOptions: {
            cacheControl: true,
            maxAge: 31536000,
          },
        }),
        GlobalHelpersModule.register({ email, ssoLoginMethod, captcha, ai }),
      ],
    };
  }
}

import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import * as dotenv from 'dotenv';
import { join } from 'path';

const withNextIntl = createNextIntlPlugin('./src/vitnode.config.ts');

dotenv.config({
  path: join(process.cwd(), '..', '..', '.env'),
});

export const vitNodeNextConfig = (config: NextConfig): NextConfig =>
  withNextIntl({
    ...config,
    devIndicators: {
      position: 'bottom-right',
    },
    env: {
      ...config.env,
      POSTGRES_URL: process.env.POSTGRES_URL ?? '',
      POSTGRES_HOST: process.env.POSTGRES_HOST ?? 'localhost',
      POSTGRES_PORT: process.env.POSTGRES_PORT
        ? process.env.POSTGRES_PORT
        : '5432',
      POSTGRES_USER: process.env.POSTGRES_USER ?? 'root',
      POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD ?? 'root',
      POSTGRES_NAME: process.env.POSTGRES_NAME ?? 'vitnode',
      POSTGRES_SSL: process.env.POSTGRES_SSL === 'true' ? 'true' : 'false',
    },
  });
